const express = require("express");
const { getMe, login, logout, register } = require("../controllers/auth.controller");
const { authRateLimiter } = require("../config/rate-limiters");
const { asyncHandler } = require("../middleware/error-handler");
const { requireAuth } = require("../middleware/require-auth");
const { requireDB } = require("../middleware/require-db");
const { validateBody } = require("../middleware/validate");
const { authLoginSchema, authRegisterSchema } = require("../validation/schemas");

const router = express.Router();

router.post("/auth/register", authRateLimiter, requireDB, validateBody(authRegisterSchema), asyncHandler(register));
router.post("/auth/login", authRateLimiter, requireDB, validateBody(authLoginSchema), asyncHandler(login));
router.get("/auth/me", requireAuth, getMe);
router.post("/auth/logout", requireDB, logout);

module.exports = router;
