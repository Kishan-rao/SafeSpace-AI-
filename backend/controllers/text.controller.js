const { getDBStatus } = require("../config/db");
const { SERVER_BOOTED_AT, SERVER_SESSION_ID } = require("../config/server-info");
const { analyzeText, MODEL_INFO: TEXT_MODEL_INFO } = require("../text-analysis-service");
const { childLogger } = require("../utils/request-logger");

function getTextHealth(req, res) {
  res.status(200).json({
    ok: true,
    service: "text-analysis",
    model: TEXT_MODEL_INFO,
    database: getDBStatus(),
    serverSessionId: SERVER_SESSION_ID,
    bootedAt: SERVER_BOOTED_AT,
    requestId: req.id,
    date: new Date().toISOString(),
  });
}

async function analyzeTextRequest(req, res) {
  const text = String(req.validatedBody.text || "");
  const logger = childLogger(req);
  const result = await analyzeText(text, { logger });
  res.status(200).json(result);
}

module.exports = {
  analyzeTextRequest,
  getTextHealth,
};
