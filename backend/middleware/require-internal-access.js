const { sendApiError } = require("./error-handler");
const { getBearerToken, getClientIp } = require("../utils/request-helpers");

function requireInternalAccess(req, res, next) {
  const adminKey = process.env.METRICS_API_KEY;

  if (!adminKey) {
    const ip = getClientIp(req) || req.socket.remoteAddress || "";
    const isLocal = ip === "::1" || ip === "127.0.0.1" || ip.startsWith("::ffff:127.");
    if (!isLocal) {
      return sendApiError(req, res, 403, "Forbidden", "Metrics endpoint is restricted.");
    }
    return next();
  }

  const provided = getBearerToken(req);
  if (!provided || provided !== adminKey) {
    return sendApiError(req, res, 403, "Forbidden", "Invalid or missing metrics API key.");
  }

  next();
}

module.exports = {
  requireInternalAccess,
};
