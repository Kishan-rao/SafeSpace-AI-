const { z } = require("zod");

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  MONGODB_URI: z.string().optional(), // optional — app runs in degraded mode without DB
  MONGODB_CONNECT_TIMEOUT_MS: z.coerce.number().default(5000),
  MONGODB_SERVER_SELECTION_TIMEOUT_MS: z.coerce.number().optional(),
  MONGODB_MAX_POOL_SIZE: z.coerce.number().default(20),
  MONGODB_MIN_POOL_SIZE: z.coerce.number().default(0),
  GROQ_API_KEY: z.string().optional(), // optional — fallback path exists in analyzeText
  GROQ_MODEL: z.string().default("llama-3.3-70b-versatile"),
  GROQ_TIMEOUT_MS: z.coerce.number().default(15000),
  ALLOWED_ORIGINS: z.string().default("http://localhost:3000"),
  TRUST_PROXY: z.string().optional(),
  API_RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
  API_RATE_LIMIT_MAX: z.coerce.number().default(180),
  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().default(15 * 60000),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().default(20),
  ANALYSIS_RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
  ANALYSIS_RATE_LIMIT_MAX: z.coerce.number().default(60),
  METRICS_API_KEY: z.string().optional(),
  LOG_LEVEL: z.string().default("info"),
});

// Memoised — loadEnv() is called at boot by server.js first, then subsequent
// calls from rate-limiters.js / groq-provider.js etc. return the cached result.
let cachedEnv = null;

function loadEnv() {
  if (cachedEnv) return cachedEnv;

  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error("Invalid environment configuration:");
    result.error.issues.forEach((issue) => {
      console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
    });
    process.exit(1);
  }

  cachedEnv = result.data;
  return cachedEnv;
}

// Allow tests to reset the cache between runs
function _resetEnvCache() {
  cachedEnv = null;
}

module.exports = { loadEnv, _resetEnvCache };
