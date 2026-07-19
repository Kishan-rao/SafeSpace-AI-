const express = require("express");
const {
  analyzeExpressionRequest,
  getExpressionHealth,
} = require("../controllers/expression.controller");
const { analysisRateLimiter } = require("../config/rate-limiters");
const { asyncHandler } = require("../middleware/error-handler");

const router = express.Router();

router.get("/expression/health", getExpressionHealth);
router.post("/expression/analyze", analysisRateLimiter, asyncHandler(analyzeExpressionRequest));

module.exports = router;
