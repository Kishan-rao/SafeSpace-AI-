const Checkin = require("../models/Checkin");

const SELECT_FIELDS =
  "text sentiment stress emotion risk support primaryEmotionKey expressionLabel expressionScores safety createdAt";

async function createCheckin(doc) {
  return Checkin.create(doc);
}

async function findRecentByUser(userId, limit) {
  return Checkin.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select(SELECT_FIELDS)
    .lean();
}

async function countByQuery(query) {
  return Checkin.countDocuments(query);
}

async function findPageByQuery(query, { skip, limit }) {
  return Checkin.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .select(SELECT_FIELDS)
    .lean();
}

async function aggregateSummary(query) {
  const [summary] = await Checkin.aggregate([
    { $match: query },
    {
      $group: {
        _id: null,
        totalEntries: { $sum: 1 },
        averageSentiment: { $avg: "$sentiment" },
        averageStress: { $avg: "$stress" },
        highRiskCount: {
          $sum: {
            $cond: [{ $eq: ["$risk", "High"] }, 1, 0],
          },
        },
      },
    },
  ]);
  return summary || null;
}

async function aggregateEmotionCounts(query) {
  const [emotionSummary] = await Checkin.aggregate([
    { $match: query },
    {
      $group: {
        _id: "$emotion",
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1, _id: 1 } },
    { $limit: 1 },
  ]);
  return emotionSummary || null;
}

async function findTrendByQuery(query, limit) {
  return Checkin.find(query)
    .select("text sentiment stress emotion risk createdAt")
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
}

async function findCalendarByQuery(query) {
  return Checkin.find(query)
    .select("sentiment stress emotion risk createdAt")
    .sort({ createdAt: 1 })
    .lean();
}

module.exports = {
  aggregateEmotionCounts,
  aggregateSummary,
  countByQuery,
  createCheckin,
  findCalendarByQuery,
  findPageByQuery,
  findRecentByUser,
  findTrendByQuery,
};
