const Checkin = require("./models/Checkin");

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

  // Mongoose documents need to be converted to plain objects
  // or we need to rename _id to id for the frontend API format
  const entryObj = entry.toObject();
  entryObj.id = entryObj._id.toString();
  delete entryObj._id;
  delete entryObj.__v;

  return entryObj;
}

async function listRecentCheckins(userId, limit = 5) {
  const checkins = await Checkin.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
    
  return checkins.map(entry => {
    entry.id = entry._id.toString();
    delete entry._id;
    delete entry.__v;
    return entry;
  }).reverse(); // Since original implementation revered the slice to make older things first or newest? Original did: sort(desc), slice(0, 5), reverse() => returns chronological order
}

module.exports = {
  listRecentCheckins,
  saveCheckin,
};
