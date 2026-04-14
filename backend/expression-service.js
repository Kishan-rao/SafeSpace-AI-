const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");

const MODEL_INFO = {
  id: "safespace-expression-processor",
  version: "1.0.0",
  mode: "hybrid-client-signal",
};

const EXPRESSION_KEYS = ["neutral", "happy", "sad", "angry", "fearful", "disgusted", "surprised"];

const LABEL_MAP = {
  neutral: "Neutral",
  happy: "Happy",
  sad: "Sad",
  angry: "Angry",
  fearful: "Fearful",
  disgusted: "Disgusted",
  surprised: "Surprised",
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function normalizeScores(scores = {}) {
  const sanitized = {};
  let total = 0;

  EXPRESSION_KEYS.forEach((key) => {
    const value = Number(scores[key]) || 0;
    const safeValue = clamp(value, 0, 1);
    sanitized[key] = safeValue;
    total += safeValue;
  });

  if (total <= 0) {
    return {
      neutral: 1,
      happy: 0,
      sad: 0,
      angry: 0,
      fearful: 0,
      disgusted: 0,
      surprised: 0,
    };
  }

  const normalized = {};
  EXPRESSION_KEYS.forEach((key) => {
    normalized[key] = Number((sanitized[key] / total).toFixed(4));
  });

  return normalized;
}

function getDominantExpression(expressionScores) {
  const ranked = Object.entries(expressionScores).sort((a, b) => b[1] - a[1]);
  const [topKey, topValue] = ranked[0];
  const secondValue = ranked[1]?.[1] || 0;
  const topPercent = Math.round(topValue * 100);
  const marginPercent = Math.round((topValue - secondValue) * 100);
  const reliability = clamp(
    Math.round(topPercent * 0.72 + Math.max(marginPercent, 0) * 0.28),
    0,
    100
  );

  return {
    key: topKey,
    label: LABEL_MAP[topKey] || topKey,
    confidence: topPercent,
    margin: marginPercent,
    reliability,
  };
}

function buildInsight(sourceType, dominantExpression) {
  if (dominantExpression.reliability >= 75) {
    return `${dominantExpression.label} is coming through clearly in this capture. The backend marked this frame as high-confidence.`;
  }

  if (dominantExpression.reliability >= 50) {
    return `${dominantExpression.label} is the leading signal, but the frame is only moderately stable. Another capture can improve confidence.`;
  }

  if (sourceType === "demo") {
    return "This result came from the demo fallback path, so it should be treated as a low-confidence placeholder.";
  }

  return "The backend received a weak facial signal. Better lighting and a front-facing pose should improve the next capture.";
}

function createFrameDigest(imageDataUrl = "") {
  if (!imageDataUrl) {
    return null;
  }

  return crypto.createHash("sha1").update(imageDataUrl).digest("hex");
}

async function appendAuditLog(entry) {
  const dataDir = path.join(__dirname, "..", "data");
  const logPath = path.join(dataDir, "expression-audit.jsonl");
  await fs.mkdir(dataDir, { recursive: true });
  await fs.appendFile(logPath, `${JSON.stringify(entry)}\n`, "utf8");
}

async function analyzeExpression(payload = {}, requestMetadata = {}) {
  const sourceType = payload.sourceType === "demo" ? "demo" : "live";
  const expressionScores = normalizeScores(payload.expressionScores);
  const dominantExpression = getDominantExpression(expressionScores);

  const result = {
    sourceType,
    model: MODEL_INFO,
    expressionScores,
    dominantExpression,
    confidence: {
      top: dominantExpression.confidence,
      margin: dominantExpression.margin,
      reliability: dominantExpression.reliability,
    },
    insight: buildInsight(sourceType, dominantExpression),
    frame: {
      capturedAt: payload.frame?.capturedAt || new Date().toISOString(),
      width: Number(payload.frame?.width) || 0,
      height: Number(payload.frame?.height) || 0,
      hasImage: Boolean(payload.frame?.imageDataUrl),
    },
  };

  await appendAuditLog({
    recordedAt: new Date().toISOString(),
    sourceType,
    dominantExpression: result.dominantExpression,
    confidence: result.confidence,
    frame: {
      width: result.frame.width,
      height: result.frame.height,
      imageDigest: createFrameDigest(payload.frame?.imageDataUrl),
    },
    request: {
      ip: requestMetadata.ip || null,
      userAgent: requestMetadata.userAgent || null,
    },
    model: MODEL_INFO,
  });

  return result;
}

module.exports = {
  MODEL_INFO,
  analyzeExpression,
};
