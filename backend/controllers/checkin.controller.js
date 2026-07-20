const { createHttpError } = require("../middleware/error-handler");
const { listCheckins, listRecentCheckins, saveCheckin } = require("../checkin-service");

async function getCheckins(req, res) {
  const result = await listCheckins(req.user.id, {
    page: req.query.page,
    limit: req.query.limit,
    emotion: req.query.emotion,
    risk: req.query.risk,
    month: req.query.month,
  });
  res.status(200).json(result);
}

async function createCheckin(req, res) {
  try {
    const checkin = await saveCheckin(req.user.id, req.body);
    const checkins = await listRecentCheckins(req.user.id, 5);
    res.status(201).json({ checkin, checkins });
  } catch (error) {
    throw createHttpError(400, "Check-in could not be saved", error.message);
  }
}

module.exports = {
  createCheckin,
  getCheckins,
};
