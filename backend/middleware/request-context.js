const crypto = require("crypto");

function createRequestId() {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return crypto.randomBytes(16).toString("hex");
}

function getIncomingRequestId(request) {
  const header = request.headers["x-request-id"];
  if (Array.isArray(header)) {
    return header[0];
  }

  return typeof header === "string" ? header.trim() : "";
}

function requestContext() {
  return (req, res, next) => {
    const incomingRequestId = getIncomingRequestId(req);
    req.id = incomingRequestId || createRequestId();
    res.setHeader("X-Request-Id", req.id);
    next();
  };
}

module.exports = {
  requestContext,
};
