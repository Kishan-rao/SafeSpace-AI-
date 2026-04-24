const Checkin = require("./models/Checkin");

function normalizeCheckin(entry) {
  const normalized = { ...entry };
  normalized.id = normalized._id.toString();
  delete normalized._id;
  delete normalized.__v;
  return normalized;
}

function clampInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(parsed, min), max);
}

async function saveCheckin(userId, payload) {
  const entry = await Checkin.create({
    userId,
    text: String(payload.text || "").trim(),
    sentiment: Number(payload.sentiment) || 0,
    stress: Number(payload.stress) || 0,
    emotion: String(payload.emotion || "Neutral"),
    risk: String(payload.risk || "Low"),
    support: String(payload.support || "Gentle check-in"),
    primaryEmotionKey: String(payload.primaryEmotionKey || "neutral"),
    expressionLabel: String(payload.expressionLabel || "Not captured yet"),
    expressionScores: payload.expressionScores || null,
  });

  const entryObj = entry.toObject();
  return normalizeCheckin(entryObj);
}

async function listRecentCheckins(userId, limit = 5) {
  const checkins = await Checkin.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return checkins.map(normalizeCheckin).reverse();
}

function buildCheckinQuery(userId, filters = {}) {
  const query = { userId };
  const emotion = String(filters.emotion || "").trim();
  const risk = String(filters.risk || "").trim();

  if (emotion) {
    query.emotion = new RegExp(`^${emotion.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
  }

  if (risk) {
    query.risk = new RegExp(`^${risk.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
  }

  return query;
}

function summarizeCheckins(checkins) {
  if (!checkins.length) {
    return {
      totalEntries: 0,
      averageSentiment: 0,
      averageStress: 0,
      mostCommonEmotion: "No entries yet",
      highRiskCount: 0,
    };
  }

  const emotionCounts = new Map();
  const totals = checkins.reduce(
    (summary, entry) => {
      const emotion = entry.emotion || "Neutral";
      emotionCounts.set(emotion, (emotionCounts.get(emotion) || 0) + 1);
      summary.sentiment += Number(entry.sentiment) || 0;
      summary.stress += Number(entry.stress) || 0;
      summary.highRisk += entry.risk === "High" ? 1 : 0;
      return summary;
    },
    { sentiment: 0, stress: 0, highRisk: 0 }
  );

  const mostCommonEmotion =
    [...emotionCounts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] || "Neutral";

  return {
    totalEntries: checkins.length,
    averageSentiment: Math.round(totals.sentiment / checkins.length),
    averageStress: Math.round(totals.stress / checkins.length),
    mostCommonEmotion,
    highRiskCount: totals.highRisk,
  };
}

async function listCheckins(userId, options = {}) {
  const page = clampInteger(options.page, 1, 1, 100000);
  const limit = clampInteger(options.limit, 20, 1, 50);
  const query = buildCheckinQuery(userId, options);
  const skip = (page - 1) * limit;

  const [total, pageEntries, summaryEntries] = await Promise.all([
    Checkin.countDocuments(query),
    Checkin.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Checkin.find(query).select("sentiment stress emotion risk createdAt").sort({ createdAt: 1 }).lean(),
  ]);

  const totalPages = Math.max(Math.ceil(total / limit), 1);

  return {
    checkins: pageEntries.map(normalizeCheckin),
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
    filters: {
      emotion: String(options.emotion || "").trim(),
      risk: String(options.risk || "").trim(),
    },
    summary: summarizeCheckins(summaryEntries),
    trend: summaryEntries.slice(-20).map(normalizeCheckin),
  };
}

module.exports = {
  listCheckins,
  listRecentCheckins,
  saveCheckin,
};
