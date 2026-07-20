const express = require("express");
const { analyzeTextRequest, getTextHealth } = require("../controllers/text.controller");
const { analysisRateLimiter } = require("../config/rate-limiters");
const { asyncHandler } = require("../middleware/error-handler");
const { validateBody } = require("../middleware/validate");
const { textAnalyzeSchema } = require("../validation/schemas");

const router = express.Router();

router.get("/text/health", getTextHealth);
router.post("/text/analyze", analysisRateLimiter, validateBody(textAnalyzeSchema), asyncHandler(analyzeTextRequest));

module.exports = router;
