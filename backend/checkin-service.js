const mongoose = require("mongoose");
const repo = require("./repositories/checkin-repository");

const CHECKIN_SELECT_FIELDS =
  "text sentiment stress emotion risk support primaryEmotionKey expressionLabel expressionScores safety createdAt";

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

function parseDate(value) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getCalendarRange(monthValue) {
  const now = new Date();
  const match = String(monthValue || "").match(/^(\d{4})-(\d{2})$/);
  const year = match ? Number(match[1]) : now.getUTCFullYear();
  const monthIndex = match ? Number(match[2]) - 1 : now.getUTCMonth();
  const safeYear = Number.isInteger(year) && year >= 1970 && year <= 9999 ? year : now.getUTCFullYear();
  const safeMonthIndex = Number.isInteger(monthIndex) && monthIndex >= 0 && monthIndex <= 11 ? monthIndex : now.getUTCMonth();
  const start = new Date(Date.UTC(safeYear, safeMonthIndex, 1));
  const end = new Date(Date.UTC(safeYear, safeMonthIndex + 1, 1));

  return {
    start,
    end,
    month: `${safeYear}-${String(safeMonthIndex + 1).padStart(2, "0")}`,
  };
}

function normalizeExactFilter(value) {
  return String(value || "").trim();
}

function buildCheckinQuery(userId, filters = {}) {
  const query = {
    userId: typeof userId === "string" && mongoose.Types.ObjectId.isValid(userId)
      ? new mongoose.Types.ObjectId(userId)
      : userId
  };
  const emotion = normalizeExactFilter(filters.emotion);
  const risk = normalizeExactFilter(filters.risk);
  const from = parseDate(filters.from);
  const to = parseDate(filters.to);

  if (emotion) {
    query.emotion = emotion;
  }

  if (risk) {
    query.risk = risk;
  }

  if (from || to) {
    query.createdAt = {};
    if (from) {
      query.createdAt.$gte = from;
    }
    if (to) {
      query.createdAt.$lt = to;
    }
  }

  return query;
}

async function summarizeCheckins(query) {
  const summary = await repo.aggregateSummary(query);

  if (!summary) {
    return {
      totalEntries: 0,
      averageSentiment: 0,
      averageStress: 0,
      mostCommonEmotion: "No entries yet",
      highRiskCount: 0,
    };
  }

  const emotionSummary = await repo.aggregateEmotionCounts(query);

  return {
    totalEntries: summary.totalEntries,
    averageSentiment: Math.round(summary.averageSentiment || 0),
    averageStress: Math.round(summary.averageStress || 0),
    mostCommonEmotion: emotionSummary?._id || "Neutral",
    highRiskCount: summary.highRiskCount || 0,
  };
}

async function saveCheckin(userId, payload) {
  const entry = await repo.createCheckin({
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
    safety: payload.safety || null,
  });

  const entryObj = entry.toObject();
  return normalizeCheckin(entryObj);
}

async function listRecentCheckins(userId, limit = 5) {
  const checkins = await repo.findRecentByUser(userId, limit);
  return checkins.map(normalizeCheckin).reverse();
}

async function listCheckins(userId, options = {}) {
  const page = clampInteger(options.page, 1, 1, 100000);
  const limit = clampInteger(options.limit, 20, 1, 50);
  const query = buildCheckinQuery(userId, options);
  const calendarRange = getCalendarRange(options.month);
  const calendarQuery = buildCheckinQuery(userId, {
    from: calendarRange.start,
    to: calendarRange.end,
  });
  const skip = (page - 1) * limit;

  const [total, pageEntries, summary, trendEntries, calendarEntries] = await Promise.all([
    repo.countByQuery(query),
    repo.findPageByQuery(query, { skip, limit }),
    summarizeCheckins(query),
    repo.findTrendByQuery(query, 20),
    repo.findCalendarByQuery(calendarQuery),
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
      month: calendarRange.month,
    },
    summary,
    trend: trendEntries.map(normalizeCheckin).reverse(),
    calendar: calendarEntries.map(normalizeCheckin),
  };
}

module.exports = {
  listCheckins,
  listRecentCheckins,
  saveCheckin,
};
