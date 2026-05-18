require("dotenv").config();
const express = require("express");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const mongoose = require("mongoose");
const { connectDB, getDBStatus, isDBReady } = require("./backend/config/db");
const { getMetricsSnapshot, metricsMiddleware } = require("./backend/metrics");
const { createRateLimiter } = require("./backend/middleware/rate-limit");
const { requestContext } = require("./backend/middleware/request-context");
const {
  asyncHandler,
  createHttpError,
  errorHandler,
  notFoundHandler,
  sendApiError,
} = require("./backend/middleware/error-handler");

const { analyzeExpression, MODEL_INFO } = require("./backend/expression-service");
const { analyzeText, MODEL_INFO: TEXT_MODEL_INFO } = require("./backend/text-analysis-service");
const { getUserForToken, invalidateSession, loginUser, registerUser } = require("./backend/auth-service");
const { listCheckins, listRecentCheckins, saveCheckin } = require("./backend/checkin-service");

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;
const FRONTEND_DIR = path.join(ROOT_DIR, "frontend");

const SERVER_BOOTED_AT = new Date().toISOString();
const SERVER_SESSION_ID = `${process.pid}-${Date.now()}`;
const IS_PRODUCTION = process.env.NODE_ENV === "production";

// FIX 1: Max check-in text length to prevent abuse (2MB body limit is too generous for plain text)
const MAX_CHECKIN_TEXT_LENGTH = 2000;

const apiRateLimiter = createRateLimiter({
  windowMs: Number(process.env.API_RATE_LIMIT_WINDOW_MS) || 60_000,
  max: Number(process.env.API_RATE_LIMIT_MAX) || 180,
  skip: (req) => ["/api/health", "/api/live", "/api/ready"].includes(req.originalUrl.split("?")[0]),
});

const authRateLimiter = createRateLimiter({
  windowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 15 * 60_000,
  max: Number(process.env.AUTH_RATE_LIMIT_MAX) || 20,
  message: "Too many authentication attempts. Please wait before trying again.",
  keyGenerator: (req) => `${req.ip}:${req.path}`,
});

const analysisRateLimiter = createRateLimiter({
  windowMs: Number(process.env.ANALYSIS_RATE_LIMIT_WINDOW_MS) || 60_000,
  max: Number(process.env.ANALYSIS_RATE_LIMIT_MAX) || 60,
  message: "Analysis requests are arriving too quickly. Please try again shortly.",
});

// ----- Connect Database -----
connectDB();

// ----- Middlewares -----
app.set("trust proxy", process.env.TRUST_PROXY === "true" ? 1 : false);
morgan.token("id", (req) => req.id);
app.use(requestContext());
app.use(metricsMiddleware());

// FIX 2: Enable Helmet with a proper Content Security Policy instead of disabling it.
// This prevents XSS, clickjacking, and other injection attacks.
// The directives below allow the fonts, CDN scripts (face-api), and your own API origin.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          // face-api.js loaded from jsDelivr CDN
          "https://cdn.jsdelivr.net",
        ],
        styleSrc: [
          "'self'",
          // Google Fonts stylesheets
          "https://fonts.googleapis.com",
          // Allow inline styles used by the frontend
          "'unsafe-inline'",
        ],
        fontSrc: [
          "'self'",
          // Google Fonts files
          "https://fonts.gstatic.com",
        ],
        imgSrc: [
          "'self'",
          // Allow data: URLs for webcam canvas snapshots
          "data:",
        ],
        connectSrc: [
          "'self'",
          // face-api model weights fetched from jsDelivr
          "https://cdn.jsdelivr.net",
        ],
        mediaSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: IS_PRODUCTION ? [] : null,
      },
    },
    // Prevent clickjacking
    frameguard: { action: "deny" },
    // Force HTTPS in production
    hsts: IS_PRODUCTION
      ? { maxAge: 31536000, includeSubDomains: true, preload: true }
      : false,
  })
);

// FIX 3: Lock down CORS to only allow your own frontend origin.
// Previously `cors()` with no options allowed ANY origin to call your API,
// which means any malicious website could make authenticated requests on behalf of your users.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:3000")
  .split(",")
  .map((o) => o.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow server-to-server requests (no origin) and listed origins
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin ${origin} is not allowed`));
      }
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.use(morgan(":id :method :url :status :response-time ms - :res[content-length]"));

// FIX 4: Reduce body size limit from 2mb to something reasonable for text check-ins.
// 2mb was far too large and could be used to slow down the server with large payloads.
// Expression frames (base64 JPEG) can be ~100-150kb, so 512kb is a safe ceiling.
app.use(express.json({ limit: "512kb" }));
app.use("/api", apiRateLimiter);

// Serve static frontend files
app.use(express.static(FRONTEND_DIR));

// ----- Helper Functions -----
function getClientIp(request) {
  const forwarded = request.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return request.socket.remoteAddress || null;
}

function getBearerToken(request) {
  const authHeader = request.headers.authorization || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

// Custom middleware to require user authentication
async function requireAuth(req, res, next) {
  try {
    if (!isDBReady()) {
      return sendApiError(
        req,
        res,
        503,
        "Database unavailable",
        "Authentication is temporarily unavailable because MongoDB is not connected."
      );
    }

    const token = getBearerToken(req);
    if (!token) {
      return sendApiError(req, res, 401, "Authentication required", "Sign in before using this endpoint.");
    }

    const user = await getUserForToken(token);
    if (!user) {
      return sendApiError(req, res, 401, "Authentication required", "Your session is invalid or expired.");
    }

    req.token = token;
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

function requireDB(req, res, next) {
  if (!isDBReady()) {
    return sendApiError(
      req,
      res,
      503,
      "Database unavailable",
      "This endpoint requires MongoDB. Check MONGODB_URI, Atlas network access, and credentials."
    );
  }
  next();
}

// FIX 5: Add an admin/internal-only guard for sensitive endpoints like /api/metrics.
// Without this, anyone on the internet can read your server internals, request counts,
// route performance data, and database status.
function requireInternalAccess(req, res, next) {
  const adminKey = process.env.METRICS_API_KEY;

  // If no key is configured, fall back to localhost-only access
  if (!adminKey) {
    const ip = getClientIp(req) || req.socket.remoteAddress || "";
    const isLocal = ip === "::1" || ip === "127.0.0.1" || ip.startsWith("::ffff:127.");
    if (!isLocal) {
      return sendApiError(req, res, 403, "Forbidden", "Metrics endpoint is restricted.");
    }
    return next();
  }

  const provided = getBearerToken(req);
  if (!provided || provided !== adminKey) {
    return sendApiError(req, res, 403, "Forbidden", "Invalid or missing metrics API key.");
  }

  next();
}

// ----- Routes -----

// Health Endpoints (public — intentionally no auth)
app.get("/api/health", (req, res) => {
  res.status(200).json({
    ok: true,
    service: "safespace-backend",
    database: getDBStatus(),
    serverSessionId: SERVER_SESSION_ID,
    bootedAt: SERVER_BOOTED_AT,
    requestId: req.id,
    date: new Date().toISOString(),
  });
});

app.get("/api/live", (req, res) => {
  res.status(200).json({
    ok: true,
    service: "safespace-backend",
    serverSessionId: SERVER_SESSION_ID,
    bootedAt: SERVER_BOOTED_AT,
    requestId: req.id,
  });
});

app.get("/api/ready", (req, res) => {
  const ready = isDBReady();
  res.status(ready ? 200 : 503).json({
    ok: ready,
    service: "safespace-backend",
    database: getDBStatus(),
    requestId: req.id,
  });
});

// FIX 5 applied: /api/metrics is now restricted to localhost or valid API key
app.get("/api/metrics", requireInternalAccess, (req, res) => {
  res.status(200).json({
    ok: true,
    service: "safespace-backend",
    database: getDBStatus(),
    metrics: getMetricsSnapshot(),
    requestId: req.id,
  });
});

app.get("/api/expression/health", (req, res) => {
  res.status(200).json({
    ok: true,
    service: "expression-processing",
    model: MODEL_INFO,
    database: getDBStatus(),
    serverSessionId: SERVER_SESSION_ID,
    bootedAt: SERVER_BOOTED_AT,
    requestId: req.id,
    date: new Date().toISOString(),
  });
});

app.get("/api/text/health", (req, res) => {
  res.status(200).json({
    ok: true,
    service: "text-analysis",
    model: TEXT_MODEL_INFO,
    database: getDBStatus(),
    serverSessionId: SERVER_SESSION_ID,
    bootedAt: SERVER_BOOTED_AT,
    requestId: req.id,
    date: new Date().toISOString(),
  });
});

// Expression Analysis
app.post(
  "/api/expression/analyze",
  analysisRateLimiter,
  asyncHandler(async (req, res) => {
    try {
      const result = await analyzeExpression(req.body, {
        ip: getClientIp(req),
        userAgent: req.headers["user-agent"] || null,
      });
      res.status(200).json(result);
    } catch (error) {
      throw createHttpError(400, "Expression analysis failed", error.message);
    }
  })
);

// Text Analysis
// FIX 6: Validate text length before running analysis.
// Without this, someone could POST a 512kb string and run your full NLP pipeline on it
// on every request, wasting CPU and slowing responses for real users.
app.post(
  "/api/text/analyze",
  analysisRateLimiter,
  asyncHandler(async (req, res) => {
    const text = String(req.body.text || "");

    if (text.length > MAX_CHECKIN_TEXT_LENGTH) {
      throw createHttpError(
        400,
        "Text too long",
        `Check-in text must be ${MAX_CHECKIN_TEXT_LENGTH} characters or fewer.`
      );
    }

    const result = await analyzeText(text);
    res.status(200).json(result);
  })
);

// Auth Endpoints
app.post("/api/auth/register", authRateLimiter, requireDB, asyncHandler(async (req, res) => {
  try {
    const result = await registerUser(req.body);
    res.status(201).json({
      user: result.user,
      token: result.session.token,
    });
  } catch (error) {
    throw createHttpError(400, "Registration failed", error.message);
  }
}));

app.post("/api/auth/login", authRateLimiter, requireDB, asyncHandler(async (req, res) => {
  try {
    const result = await loginUser(req.body);
    res.status(200).json({
      user: result.user,
      token: result.session.token,
    });
  } catch (error) {
    throw createHttpError(401, "Login failed", error.message);
  }
}));

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.status(200).json({ user: req.user });
});

app.post("/api/auth/logout", requireDB, async (req, res, next) => {
  const token = getBearerToken(req);
  try {
    if (token) {
      await invalidateSession(token);
    }
    res.status(200).json({ ok: true });
  } catch (error) {
    next(error);
  }
});

// Check-ins Endpoints
app.get("/api/checkins", requireAuth, asyncHandler(async (req, res) => {
  const result = await listCheckins(req.user.id, {
    page: req.query.page,
    limit: req.query.limit,
    emotion: req.query.emotion,
    risk: req.query.risk,
    month: req.query.month,
  });
  res.status(200).json(result);
}));

// FIX 6 also applied here: validate text length on save, not just on analysis.
// A user could bypass the analyze endpoint and POST directly to /api/checkins
// with an arbitrarily long text string.
app.post("/api/checkins", requireAuth, asyncHandler(async (req, res) => {
  try {
    const text = String(req.body.text || "");

    if (text.length > MAX_CHECKIN_TEXT_LENGTH) {
      throw createHttpError(
        400,
        "Text too long",
        `Check-in text must be ${MAX_CHECKIN_TEXT_LENGTH} characters or fewer.`
      );
    }

    const checkin = await saveCheckin(req.user.id, req.body);
    const checkins = await listRecentCheckins(req.user.id, 5);
    res.status(201).json({ checkin, checkins });
  } catch (error) {
    throw createHttpError(400, "Check-in could not be saved", error.message);
  }
}));

// Catch-all route to serve the frontend single-page application fallback if needed
app.use((req, res, next) => {
  if (req.method === "GET" && !req.path.startsWith("/api")) {
    return res.sendFile(path.join(FRONTEND_DIR, "index.html"));
  }
  next();
});

app.use(notFoundHandler);
app.use(errorHandler({ isProduction: IS_PRODUCTION }));

const server = app.listen(PORT, () => {
  console.log(`🚀 SafeSpace server running at http://localhost:${PORT}`);
});

// FIX 7: Graceful shutdown now has a forced exit timeout.
// Previously if mongoose.disconnect() hung, the process would never exit.
// This adds a 10 second hard timeout as a safety net.
async function shutdown(signal) {
  console.log(`${signal} received. Closing SafeSpace server...`);
  server.close(async () => {
    const forceExitTimer = setTimeout(() => {
      console.error("Graceful shutdown timed out. Forcing exit.");
      process.exit(1);
    }, 10_000);

    try {
      await mongoose.disconnect();
      clearTimeout(forceExitTimer);
      process.exit(0);
    } catch (error) {
      console.error("Error during shutdown:", error);
      clearTimeout(forceExitTimer);
      process.exit(1);
    }
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
});
process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
  shutdown("uncaughtException");
});