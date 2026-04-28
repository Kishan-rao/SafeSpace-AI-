const mongoose = require("mongoose");

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

async function connectDB() {
  const mongoUri = process.env.MONGODB_URI;
  const timeoutMs = Number(process.env.MONGODB_CONNECT_TIMEOUT_MS) || 5000;

  if (!mongoUri) {
    const error = new Error("MONGODB_URI is not configured.");
    setDisconnectedStatus(error);
    console.error(`MongoDB configuration error: ${error.message}`);
    return null;
  }

  try {
    dbStatus.state = "connecting";
    dbStatus.lastError = null;

    const connectionAttempt = mongoose.connect(mongoUri, {
      connectTimeoutMS: timeoutMs,
      serverSelectionTimeoutMS: Number(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS) || timeoutMs,
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

    console.log(`MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    setDisconnectedStatus(error);
    if (mongoose.connection.readyState !== 1) {
      await mongoose.disconnect().catch(() => {});
    }
    console.error(`MongoDB connection error: ${error.message}`);
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
