function clampNumber(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(parsed, min), max);
}

function createMemoryStore(windowMs) {
  const buckets = new Map();
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets.entries()) {
      if (bucket.resetAt <= now) {
        buckets.delete(key);
      }
    }
  }, Math.min(windowMs, 60_000));

  if (typeof cleanupInterval.unref === "function") {
    cleanupInterval.unref();
  }

  return {
    hit(key) {
      const now = Date.now();
      const existing = buckets.get(key);

      if (!existing || existing.resetAt <= now) {
        const bucket = { count: 1, resetAt: now + windowMs };
        buckets.set(key, bucket);
        return bucket;
      }

      existing.count += 1;
      return existing;
    },
  };
}

function defaultKeyGenerator(req) {
  return req.ip || req.socket.remoteAddress || "unknown";
}

function createRateLimiter(options = {}) {
  const windowMs = clampNumber(options.windowMs, 60_000, 1_000, 24 * 60 * 60 * 1000);
  const max = clampNumber(options.max, 120, 1, 100_000);
  const keyGenerator = options.keyGenerator || defaultKeyGenerator;
  const skip = options.skip || (() => false);
  const store = options.store || createMemoryStore(windowMs);
  const message = options.message || "Too many requests. Please slow down and try again shortly.";

  return (req, res, next) => {
    if (skip(req)) {
      return next();
    }

    const bucket = store.hit(keyGenerator(req));
    const resetSeconds = Math.max(Math.ceil((bucket.resetAt - Date.now()) / 1000), 1);
    const remaining = Math.max(max - bucket.count, 0);

    res.setHeader("RateLimit-Limit", String(max));
    res.setHeader("RateLimit-Remaining", String(remaining));
    res.setHeader("RateLimit-Reset", String(resetSeconds));

    if (bucket.count > max) {
      res.setHeader("Retry-After", String(resetSeconds));
      return res.status(429).json({
        ok: false,
        error: "Rate limit exceeded",
        detail: message,
        retryAfterSeconds: resetSeconds,
        requestId: req.id,
      });
    }

    return next();
  };
}

module.exports = {
  createRateLimiter,
};
