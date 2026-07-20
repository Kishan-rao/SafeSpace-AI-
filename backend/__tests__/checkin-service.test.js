const assert = require("node:assert/strict");
const test = require("node:test");
const mongoose = require("mongoose");
const repo = require("../repositories/checkin-repository");
const { buildCheckinQuery, getCalendarRange, listCheckins } = require("../checkin-service");

test("buildCheckinQuery formats query object correctly", () => {
  const validObjectIdStr = "507f1f77bcf86cd799439011";
  const query = buildCheckinQuery(validObjectIdStr, {
    emotion: "Joy",
    risk: "Low",
    from: "2026-01-01T00:00:00Z",
    to: "2026-01-31T23:59:59Z",
  });

  assert.equal(query.userId instanceof mongoose.Types.ObjectId, true);
  assert.equal(query.userId.toString(), validObjectIdStr);
  assert.equal(query.emotion, "Joy");
  assert.equal(query.risk, "Low");
  assert.equal(query.createdAt.$gte instanceof Date, true);
  assert.equal(query.createdAt.$lt instanceof Date, true);
});

test("getCalendarRange parses valid month and handles fallbacks", () => {
  const range = getCalendarRange("2026-05");
  assert.equal(range.month, "2026-05");
  assert.equal(range.start.toISOString(), "2026-05-01T00:00:00.000Z");
  assert.equal(range.end.toISOString(), "2026-06-01T00:00:00.000Z");

  const invalid = getCalendarRange("invalid-date");
  const now = new Date();
  assert.equal(invalid.month.startsWith(`${now.getUTCFullYear()}-`), true);
});

test("listCheckins computes pagination and orchestrates repository calls", async () => {
  const mockUserId = new mongoose.Types.ObjectId().toString();

  // Save original repo methods
  const origCount = repo.countByQuery;
  const origPage = repo.findPageByQuery;
  const origSummary = repo.aggregateSummary;
  const origEmotions = repo.aggregateEmotionCounts;
  const origTrend = repo.findTrendByQuery;
  const origCalendar = repo.findCalendarByQuery;

  try {
    const fakeId = new mongoose.Types.ObjectId();
    const fakeDoc = {
      _id: fakeId,
      text: "Test entry",
      sentiment: 50,
      stress: 10,
      emotion: "Neutral",
      risk: "Low",
      createdAt: new Date(),
    };

    repo.countByQuery = async () => 45;
    repo.findPageByQuery = async () => [fakeDoc];
    repo.aggregateSummary = async () => ({ totalEntries: 45, averageSentiment: 50, averageStress: 10, highRiskCount: 0 });
    repo.aggregateEmotionCounts = async () => ({ _id: "Neutral", count: 45 });
    repo.findTrendByQuery = async () => [fakeDoc];
    repo.findCalendarByQuery = async () => [fakeDoc];

    const result = await listCheckins(mockUserId, { page: 2, limit: 10 });

    assert.equal(result.pagination.page, 2);
    assert.equal(result.pagination.limit, 10);
    assert.equal(result.pagination.total, 45);
    assert.equal(result.pagination.totalPages, 5);
    assert.equal(result.pagination.hasNextPage, true);
    assert.equal(result.pagination.hasPreviousPage, true);
    assert.equal(result.checkins.length, 1);
    assert.equal(result.checkins[0].id, fakeId.toString());
  } finally {
    // Restore repo methods
    repo.countByQuery = origCount;
    repo.findPageByQuery = origPage;
    repo.aggregateSummary = origSummary;
    repo.aggregateEmotionCounts = origEmotions;
    repo.findTrendByQuery = origTrend;
    repo.findCalendarByQuery = origCalendar;
  }
});
