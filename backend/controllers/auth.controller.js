const { getBearerToken } = require("../utils/request-helpers");
const { createHttpError } = require("../middleware/error-handler");
const { invalidateSession, loginUser, registerUser } = require("../auth-service");

async function register(req, res) {
  try {
    const result = await registerUser(req.body);
    res.status(201).json({
      user: result.user,
      token: result.session.token,
    });
  } catch (error) {
    throw createHttpError(400, "Registration failed", error.message);
  }
}

async function login(req, res) {
  try {
    const result = await loginUser(req.body);
    res.status(200).json({
      user: result.user,
      token: result.session.token,
    });
  } catch (error) {
    throw createHttpError(401, "Login failed", error.message);
  }
}

function getMe(req, res) {
  res.status(200).json({ user: req.user });
}

async function logout(req, res, next) {
  const token = getBearerToken(req);
  try {
    if (token) {
      await invalidateSession(token);
    }
    res.status(200).json({ ok: true });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getMe,
  login,
  logout,
  register,
};
