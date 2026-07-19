const express = require("express");
const authRoutes = require("./auth.routes");
const checkinRoutes = require("./checkin.routes");
const expressionRoutes = require("./expression.routes");
const healthRoutes = require("./health.routes");
const textRoutes = require("./text.routes");

const router = express.Router();

router.use(healthRoutes);
router.use(textRoutes);
router.use(expressionRoutes);
router.use(authRoutes);
router.use(checkinRoutes);

module.exports = router;
