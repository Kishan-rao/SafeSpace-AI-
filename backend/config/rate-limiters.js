const { createRateLimiter } = require("../middleware/rate-limit");

const apiRateLimiter = createRateLimiter({
  windowMs: Number(process.env.API_RATE_LIMIT_WINDOW_MS) || 60_000,
  max: Number(process.env.API_RATE_LIMIT_MAX) || 180,
  skip: (req) => ["/api/health", "/api/live", "/api/ready"].includes(req.originalUrl.split("?")[0]),
});

const authRateLimiter = createRateLimiter({
  windowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 15 * 60_000,
  max: Number(process.env.AUTH_RATE_LIMIT_MAX) || 20,
  message: "Too many authentication attempts. Please wait before trying again.",
  keyGenerator: (req) => `${req.ip}:${req.originalUrl.split("?")[0]}`,
});

const analysisRateLimiter = createRateLimiter({
  windowMs: Number(process.env.ANALYSIS_RATE_LIMIT_WINDOW_MS) || 60_000,
  max: Number(process.env.ANALYSIS_RATE_LIMIT_MAX) || 60,
  message: "Analysis requests are arriving too quickly. Please try again shortly.",
});

module.exports = {
  analysisRateLimiter,
  apiRateLimiter,
  authRateLimiter,
};
