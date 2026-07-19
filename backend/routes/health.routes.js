const express = require("express");
const { getHealth, getLive, getMetrics, getReady } = require("../controllers/health.controller");
const { requireInternalAccess } = require("../middleware/require-internal-access");

const router = express.Router();

router.get("/health", getHealth);
router.get("/live", getLive);
router.get("/ready", getReady);
router.get("/metrics", requireInternalAccess, getMetrics);

module.exports = router;
