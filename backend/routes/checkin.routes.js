const express = require("express");
const { createCheckin, getCheckins } = require("../controllers/checkin.controller");
const { asyncHandler } = require("../middleware/error-handler");
const { requireAuth } = require("../middleware/require-auth");

const router = express.Router();

router.get("/checkins", requireAuth, asyncHandler(getCheckins));
router.post("/checkins", requireAuth, asyncHandler(createCheckin));

module.exports = router;
