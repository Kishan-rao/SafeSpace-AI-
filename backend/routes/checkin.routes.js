const express = require("express");
const { createCheckin, getCheckins } = require("../controllers/checkin.controller");
const { asyncHandler } = require("../middleware/error-handler");
const { requireAuth } = require("../middleware/require-auth");
const { validateBody } = require("../middleware/validate");
const { checkinCreateSchema } = require("../validation/schemas");

const router = express.Router();

router.get("/checkins", requireAuth, asyncHandler(getCheckins));
router.post("/checkins", requireAuth, validateBody(checkinCreateSchema), asyncHandler(createCheckin));

module.exports = router;
