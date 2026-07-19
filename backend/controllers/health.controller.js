const { getDBStatus, isDBReady } = require("../config/db");
const { getMetricsSnapshot } = require("../metrics");
const { SERVER_BOOTED_AT, SERVER_SESSION_ID } = require("../config/server-info");

function getHealth(req, res) {
  res.status(200).json({
    ok: true,
    service: "safespace-backend",
    database: getDBStatus(),
    serverSessionId: SERVER_SESSION_ID,
    bootedAt: SERVER_BOOTED_AT,
    requestId: req.id,
    date: new Date().toISOString(),
  });
}

function getLive(req, res) {
  res.status(200).json({
    ok: true,
    service: "safespace-backend",
    serverSessionId: SERVER_SESSION_ID,
    bootedAt: SERVER_BOOTED_AT,
    requestId: req.id,
  });
}

function getReady(req, res) {
  const ready = isDBReady();
  res.status(ready ? 200 : 503).json({
    ok: ready,
    service: "safespace-backend",
    database: getDBStatus(),
    requestId: req.id,
  });
}

function getMetrics(req, res) {
  res.status(200).json({
    ok: true,
    service: "safespace-backend",
    database: getDBStatus(),
    metrics: getMetricsSnapshot(),
    requestId: req.id,
  });
}

module.exports = {
  getHealth,
  getLive,
  getMetrics,
  getReady,
};
