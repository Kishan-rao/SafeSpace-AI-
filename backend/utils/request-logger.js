const logger = require("../logger");

function childLogger(req) {
  return logger.child({ requestId: req.id });
}

module.exports = { childLogger };
