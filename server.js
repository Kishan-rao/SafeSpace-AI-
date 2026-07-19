require("dotenv").config();
const express = require("express");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const mongoose = require("mongoose");
const apiRoutes = require("./backend/routes");
const { apiRateLimiter } = require("./backend/config/rate-limiters");
const { connectDB } = require("./backend/config/db");
const { metricsMiddleware } = require("./backend/metrics");
const { errorHandler, notFoundHandler } = require("./backend/middleware/error-handler");
const { requestContext } = require("./backend/middleware/request-context");

const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND_DIR = path.join(__dirname, "frontend");
const IS_PRODUCTION = process.env.NODE_ENV === "production";

connectDB();

app.set("trust proxy", process.env.TRUST_PROXY === "true" ? 1 : false);
morgan.token("id", (req) => req.id);
app.use(requestContext());
app.use(metricsMiddleware());

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://cdn.jsdelivr.net"],
        styleSrc: ["'self'", "https://fonts.googleapis.com", "'unsafe-inline'"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'", "https://cdn.jsdelivr.net"],
        mediaSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: IS_PRODUCTION ? [] : null,
      },
    },
    frameguard: { action: "deny" },
    hsts: IS_PRODUCTION
      ? { maxAge: 31536000, includeSubDomains: true, preload: true }
      : false,
  })
);

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:3000")
  .split(",")
  .map((o) => o.trim());

app.use(
  cors({
    origin: (origin, callback) => {
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
app.use(express.json({ limit: "512kb" }));
app.use("/api", apiRateLimiter, apiRoutes);
app.use(express.static(FRONTEND_DIR));

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
