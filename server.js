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
// Use helmet but configure it to allow local development functionality if needed
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(morgan(":id :method :url :status :response-time ms - :res[content-length]"));
app.use(express.json({ limit: "2mb" }));
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

// ----- Routes -----

// Health Endpoints
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

app.get("/api/metrics", (req, res) => {
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
app.post("/api/text/analyze", analysisRateLimiter, (req, res, next) => {
  try {
    const result = analyzeText(req.body.text || "");
    res.status(200).json(result);
  } catch (error) {
    next(createHttpError(400, "Text analysis failed", error.message));
  }
});

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

app.post("/api/checkins", requireAuth, asyncHandler(async (req, res) => {
  try {
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

async function shutdown(signal) {
  console.log(`${signal} received. Closing SafeSpace server...`);
  server.close(async () => {
    await mongoose.disconnect();
    process.exit(0);
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
