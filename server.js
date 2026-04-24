require("dotenv").config();
const express = require("express");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const connectDB = require("./backend/config/db");

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

// ----- Connect Database -----
connectDB();

// ----- Middlewares -----
// Use helmet but configure it to allow local development functionality if needed
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(morgan("dev"));
app.use(express.json({ limit: "2mb" }));

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
  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const user = await getUserForToken(token);
  if (!user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  req.token = token;
  req.user = user;
  next();
}

// ----- Routes -----

// Health Endpoints
app.get("/api/expression/health", (req, res) => {
  res.status(200).json({
    ok: true,
    service: "expression-processing",
    model: MODEL_INFO,
    serverSessionId: SERVER_SESSION_ID,
    bootedAt: SERVER_BOOTED_AT,
    date: new Date().toISOString(),
  });
});

app.get("/api/text/health", (req, res) => {
  res.status(200).json({
    ok: true,
    service: "text-analysis",
    model: TEXT_MODEL_INFO,
    serverSessionId: SERVER_SESSION_ID,
    bootedAt: SERVER_BOOTED_AT,
    date: new Date().toISOString(),
  });
});

// Expression Analysis
app.post("/api/expression/analyze", async (req, res, next) => {
  try {
    const result = await analyzeExpression(req.body, {
      ip: getClientIp(req),
      userAgent: req.headers["user-agent"] || null,
    });
    res.status(200).json(result);
  } catch (error) {
    if (error.type === "entity.too.large") {
      return res.status(413).json({ error: "Expression analysis failed", detail: "Payload too large" });
    }
    res.status(400).json({ error: "Expression analysis failed", detail: error.message });
  }
});

// Text Analysis
app.post("/api/text/analyze", (req, res) => {
  try {
    const result = analyzeText(req.body.text || "");
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ error: "Text analysis failed", detail: error.message });
  }
});

// Auth Endpoints
app.post("/api/auth/register", async (req, res) => {
  try {
    const result = await registerUser(req.body);
    res.status(201).json({
      user: result.user,
      token: result.session.token,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const result = await loginUser(req.body);
    res.status(200).json({
      user: result.user,
      token: result.session.token,
    });
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.status(200).json({ user: req.user });
});

app.post("/api/auth/logout", async (req, res) => {
  const token = getBearerToken(req);
  if (token) {
    await invalidateSession(token);
  }
  res.status(200).json({ ok: true });
});

// Check-ins Endpoints
app.get("/api/checkins", requireAuth, async (req, res, next) => {
  try {
    const result = await listCheckins(req.user.id, {
      page: req.query.page,
      limit: req.query.limit,
      emotion: req.query.emotion,
      risk: req.query.risk,
    });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

app.post("/api/checkins", requireAuth, async (req, res, next) => {
  try {
    const checkin = await saveCheckin(req.user.id, req.body);
    const checkins = await listRecentCheckins(req.user.id, 5);
    res.status(201).json({ checkin, checkins });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Catch-all route to serve the frontend single-page application fallback if needed
app.use((req, res, next) => {
  if (req.method === "GET" && !req.path.startsWith("/api")) {
    return res.sendFile(path.join(FRONTEND_DIR, "index.html"));
  }
  next();
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal Server Error", detail: err.message });
});

app.listen(PORT, () => {
  console.log(`🚀 SafeSpace server running at http://localhost:${PORT}`);
});
