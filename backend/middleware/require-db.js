const { isDBReady } = require("../config/db");
const { sendApiError } = require("./error-handler");

function requireDB(req, res, next) {
  if (!isDBReady()) {
    return sendApiError(
      req,
      res,
      503,
      "Database unavailable",
      "This endpoint requires MongoDB. Check MONGODB_URI, Atlas network access, and credentials."
    );
  }
  next();
}

module.exports = {
  requireDB,
};
