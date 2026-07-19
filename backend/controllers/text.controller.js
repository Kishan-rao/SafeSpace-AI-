const { getDBStatus } = require("../config/db");
const { SERVER_BOOTED_AT, SERVER_SESSION_ID } = require("../config/server-info");
const { MAX_CHECKIN_TEXT_LENGTH } = require("../constants");
const { createHttpError } = require("../middleware/error-handler");
const { analyzeText, MODEL_INFO: TEXT_MODEL_INFO } = require("../text-analysis-service");

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
  const text = String(req.body.text || "");

  if (text.length > MAX_CHECKIN_TEXT_LENGTH) {
    throw createHttpError(
      400,
      "Text too long",
      `Check-in text must be ${MAX_CHECKIN_TEXT_LENGTH} characters or fewer.`
    );
  }

  const result = await analyzeText(text);
  res.status(200).json(result);
}

module.exports = {
  analyzeTextRequest,
  getTextHealth,
};
