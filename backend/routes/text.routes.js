const express = require("express");
const { analyzeTextRequest, getTextHealth } = require("../controllers/text.controller");
const { analysisRateLimiter } = require("../config/rate-limiters");
const { asyncHandler } = require("../middleware/error-handler");

const router = express.Router();

router.get("/text/health", getTextHealth);
router.post("/text/analyze", analysisRateLimiter, asyncHandler(analyzeTextRequest));

module.exports = router;
