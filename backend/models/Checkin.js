const mongoose = require("mongoose");

const checkinSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  text: {
    type: String,
    trim: true,
    default: "",
  },
  sentiment: {
    type: Number,
    default: 0,
  },
  stress: {
    type: Number,
    default: 0,
  },
  emotion: {
    type: String,
    default: "Neutral",
  },
  risk: {
    type: String,
    default: "Low",
  },
  support: {
    type: String,
    default: "Gentle check-in",
  },
  primaryEmotionKey: {
    type: String,
    default: "neutral",
  },
  expressionLabel: {
    type: String,
    default: "Not captured yet",
  },
  expressionScores: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Index to easily fetch recent checkins for a user
checkinSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("Checkin", checkinSchema);
