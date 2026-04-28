const startedAt = new Date();

const metrics = {
  totalRequests: 0,
  inFlightRequests: 0,
  totalDurationMs: 0,
  responsesByStatusClass: {},
  routes: new Map(),
};

function getRouteKey(req) {
  const routePath = req.route?.path;
  if (!routePath) {
    return `${req.method} ${req.path}`;
  }

  const prefix = req.baseUrl || "";
  return `${req.method} ${prefix}${routePath}`;
}

function recordRoute(routeKey, statusCode, durationMs) {
  const existing = metrics.routes.get(routeKey) || {
    count: 0,
    errorCount: 0,
    totalDurationMs: 0,
    maxDurationMs: 0,
  };

  existing.count += 1;
  existing.errorCount += statusCode >= 500 ? 1 : 0;
  existing.totalDurationMs += durationMs;
  existing.maxDurationMs = Math.max(existing.maxDurationMs, durationMs);
  metrics.routes.set(routeKey, existing);
}

function metricsMiddleware() {
  return (req, res, next) => {
    const started = process.hrtime.bigint();
    metrics.totalRequests += 1;
    metrics.inFlightRequests += 1;

    res.on("finish", () => {
      const durationMs = Number(process.hrtime.bigint() - started) / 1_000_000;
      const statusClass = `${Math.floor(res.statusCode / 100)}xx`;

      metrics.inFlightRequests = Math.max(metrics.inFlightRequests - 1, 0);
      metrics.totalDurationMs += durationMs;
      metrics.responsesByStatusClass[statusClass] = (metrics.responsesByStatusClass[statusClass] || 0) + 1;
      recordRoute(getRouteKey(req), res.statusCode, durationMs);
    });

    next();
  };
}

function getMetricsSnapshot() {
  const uptimeSeconds = Math.round(process.uptime());
  const routeStats = [...metrics.routes.entries()]
    .map(([route, stats]) => ({
      route,
      count: stats.count,
      errorCount: stats.errorCount,
      averageDurationMs: Number((stats.totalDurationMs / stats.count).toFixed(2)),
      maxDurationMs: Number(stats.maxDurationMs.toFixed(2)),
    }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 25);

  return {
    startedAt: startedAt.toISOString(),
    uptimeSeconds,
    process: {
      pid: process.pid,
      memory: process.memoryUsage(),
    },
    requests: {
      total: metrics.totalRequests,
      inFlight: metrics.inFlightRequests,
      averageDurationMs: metrics.totalRequests
        ? Number((metrics.totalDurationMs / metrics.totalRequests).toFixed(2))
        : 0,
      byStatusClass: metrics.responsesByStatusClass,
    },
    routes: routeStats,
  };
}

module.exports = {
  getMetricsSnapshot,
  metricsMiddleware,
};
