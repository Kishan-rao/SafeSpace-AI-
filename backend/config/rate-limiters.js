const { createRateLimiter } = require("../middleware/rate-limit");
const { loadEnv } = require("./env");

// loadEnv() is memoised — if server.js already called it at boot, this returns
// the cached validated config instantly. If called first (e.g. in tests), it
// validates process.env on the spot (all values have schema defaults, so tests
// with no .env file still succeed).
const env = loadEnv();

const apiRateLimiter = createRateLimiter({
  windowMs: env.API_RATE_LIMIT_WINDOW_MS,
  max: env.API_RATE_LIMIT_MAX,
  skip: (req) => ["/api/health", "/api/live", "/api/ready"].includes(req.originalUrl.split("?")[0]),
});

const authRateLimiter = createRateLimiter({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX,
  message: "Too many authentication attempts. Please wait before trying again.",
  keyGenerator: (req) => `${req.ip}:${req.originalUrl.split("?")[0]}`,
});

const analysisRateLimiter = createRateLimiter({
  windowMs: env.ANALYSIS_RATE_LIMIT_WINDOW_MS,
  max: env.ANALYSIS_RATE_LIMIT_MAX,
  message: "Analysis requests are arriving too quickly. Please try again shortly.",
});

module.exports = {
  analysisRateLimiter,
  apiRateLimiter,
  authRateLimiter,
};
