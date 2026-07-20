require("dotenv").config();
const { loadEnv } = require("./backend/config/env");
const env = loadEnv();

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
const logger = require("./backend/logger");

const app = express();
const PORT = env.PORT;
const FRONTEND_DIR = path.join(__dirname, "frontend");
const IS_PRODUCTION = env.NODE_ENV === "production";

connectDB({
  mongoUri: env.MONGODB_URI,
  timeoutMs: env.MONGODB_CONNECT_TIMEOUT_MS,
  serverSelectionTimeoutMs: env.MONGODB_SERVER_SELECTION_TIMEOUT_MS,
  maxPoolSize: env.MONGODB_MAX_POOL_SIZE,
  minPoolSize: env.MONGODB_MIN_POOL_SIZE,
});

app.set("trust proxy", env.TRUST_PROXY === "true" ? 1 : false);
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

const allowedOrigins = env.ALLOWED_ORIGINS
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
  logger.info(`🚀 SafeSpace server running at http://localhost:${PORT}`);
});

async function shutdown(signal) {
  logger.info(`${signal} received. Closing SafeSpace server...`);
  server.close(async () => {
    const forceExitTimer = setTimeout(() => {
      logger.error("Graceful shutdown timed out. Forcing exit.");
      process.exit(1);
    }, 10_000);

    try {
      await mongoose.disconnect();
      clearTimeout(forceExitTimer);
      process.exit(0);
    } catch (error) {
      logger.error({ err: error }, "Error during shutdown");
      clearTimeout(forceExitTimer);
      process.exit(1);
    }
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "Unhandled promise rejection");
});
process.on("uncaughtException", (error) => {
  logger.error({ err: error }, "Uncaught exception");
  shutdown("uncaughtException");
});
