const { isDBReady } = require("../config/db");
const { getUserForToken } = require("../auth-service");
const { sendApiError } = require("./error-handler");
const { getBearerToken } = require("../utils/request-helpers");

async function requireAuth(req, res, next) {
  try {
    if (!isDBReady()) {
      return sendApiError(
        req,
        res,
        503,
        "Database unavailable",
        "Authentication is temporarily unavailable because MongoDB is not connected."
      );
    }

    const token = getBearerToken(req);
    if (!token) {
      return sendApiError(req, res, 401, "Authentication required", "Sign in before using this endpoint.");
    }

    const user = await getUserForToken(token);
    if (!user) {
      return sendApiError(req, res, 401, "Authentication required", "Your session is invalid or expired.");
    }

    req.token = token;
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  requireAuth,
};
