const { getDBStatus } = require("../config/db");
const { SERVER_BOOTED_AT, SERVER_SESSION_ID } = require("../config/server-info");
const { createHttpError } = require("../middleware/error-handler");
const { analyzeExpression, MODEL_INFO } = require("../expression-service");
const { getClientIp } = require("../utils/request-helpers");

function getExpressionHealth(req, res) {
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
}

async function analyzeExpressionRequest(req, res) {
  try {
    const result = await analyzeExpression(req.body, {
      ip: getClientIp(req),
      userAgent: req.headers["user-agent"] || null,
    });
    res.status(200).json(result);
  } catch (error) {
    throw createHttpError(400, "Expression analysis failed", error.message);
  }
}

module.exports = {
  analyzeExpressionRequest,
  getExpressionHealth,
};
