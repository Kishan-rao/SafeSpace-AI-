const mongoose = require("mongoose");
const logger = require("../logger");

const dbStatus = {
  state: "disconnected",
  host: null,
  name: null,
  lastError: null,
  connectedAt: null,
};

function setDisconnectedStatus(error = null) {
  dbStatus.state = "disconnected";
  dbStatus.host = null;
  dbStatus.name = null;
  dbStatus.connectedAt = null;
  dbStatus.lastError = error ? error.message : null;
}

/**
 * @param {{
 *   mongoUri: string|undefined,
 *   timeoutMs: number,
 *   serverSelectionTimeoutMs: number|undefined,
 *   maxPoolSize: number,
 *   minPoolSize: number,
 * }} config Pre-validated values from env.js — no process.env reads here.
 */
async function connectDB(config) {
  const {
    mongoUri,
    timeoutMs,
    serverSelectionTimeoutMs,
    maxPoolSize,
    minPoolSize,
  } = config;

  if (!mongoUri) {
    const error = new Error("MONGODB_URI is not configured.");
    setDisconnectedStatus(error);
    logger.error({ err: error }, `MongoDB configuration error: ${error.message}`);
    return null;
  }

  try {
    dbStatus.state = "connecting";
    dbStatus.lastError = null;

    const connectionAttempt = mongoose.connect(mongoUri, {
      connectTimeoutMS: timeoutMs,
      serverSelectionTimeoutMS: serverSelectionTimeoutMs ?? timeoutMs,
      maxPoolSize,
      minPoolSize,
    });

    connectionAttempt.catch(() => {});

    const conn = await Promise.race([
      connectionAttempt,
      new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`MongoDB connection timed out after ${timeoutMs}ms.`));
        }, timeoutMs);
      }),
    ]);

    dbStatus.state = "connected";
    dbStatus.host = conn.connection.host;
    dbStatus.name = conn.connection.name;
    dbStatus.connectedAt = new Date().toISOString();
    dbStatus.lastError = null;

    logger.info(`MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    setDisconnectedStatus(error);
    if (mongoose.connection.readyState !== 1) {
      await mongoose.disconnect().catch(() => {});
    }
    logger.error({ err: error }, `MongoDB connection error: ${error.message}`);
    return null;
  }
}

function getDBStatus() {
  return {
    ...dbStatus,
    mongooseReadyState: mongoose.connection.readyState,
  };
}

function isDBReady() {
  return mongoose.connection.readyState === 1;
}

mongoose.connection.on("disconnected", () => {
  if (dbStatus.state !== "disconnected") {
    setDisconnectedStatus(new Error("MongoDB connection disconnected."));
  }
});

mongoose.connection.on("connected", () => {
  dbStatus.state = "connected";
  dbStatus.host = mongoose.connection.host;
  dbStatus.name = mongoose.connection.name;
  dbStatus.connectedAt = new Date().toISOString();
  dbStatus.lastError = null;
});

mongoose.connection.on("error", (error) => {
  setDisconnectedStatus(error);
});

module.exports = {
  connectDB,
  getDBStatus,
  isDBReady,
};
