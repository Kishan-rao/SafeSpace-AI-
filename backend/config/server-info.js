const SERVER_BOOTED_AT = new Date().toISOString();
const SERVER_SESSION_ID = `${process.pid}-${Date.now()}`;

module.exports = {
  SERVER_BOOTED_AT,
  SERVER_SESSION_ID,
};
