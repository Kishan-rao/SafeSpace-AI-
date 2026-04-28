const crypto = require("crypto");
const User = require("./models/User");
const Session = require("./models/Session");

function sanitizeUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
  };
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const derivedKey = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derivedKey}`;
}

function verifyPassword(password, storedHash) {
  const [salt, expected] = String(storedHash || "").split(":");
  if (!salt || !expected) {
    return false;
  }

  const derivedKey = crypto.scryptSync(password, salt, 64).toString("hex");
  const derivedBuffer = Buffer.from(derivedKey, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");

  if (derivedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(derivedBuffer, expectedBuffer);
}

function createSessionToken() {
  return crypto.randomBytes(32).toString("hex");
}

async function registerUser({ name, email, password }) {
  const normalizedEmail = normalizeEmail(email);
  const trimmedName = String(name || "").trim();
  const safePassword = String(password || "");

  if (!trimmedName || !normalizedEmail || safePassword.length < 6) {
    throw new Error("Name, email, and a password of at least 6 characters are required.");
  }

  if (!isValidEmail(normalizedEmail)) {
    throw new Error("A valid email address is required.");
  }

  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    throw new Error("An account with that email already exists.");
  }

  let user;
  try {
    user = await User.create({
      name: trimmedName,
      email: normalizedEmail,
      passwordHash: hashPassword(safePassword),
    });
  } catch (error) {
    if (error.code === 11000) {
      throw new Error("An account with that email already exists.");
    }
    throw error;
  }

  const session = await createSessionForUser(user._id);
  return {
    user: sanitizeUser(user),
    session: {
      token: session.token,
      userId: session.userId,
      createdAt: session.createdAt,
    },
  };
}

async function loginUser({ email, password }) {
  const normalizedEmail = normalizeEmail(email);
  const safePassword = String(password || "");

  if (!isValidEmail(normalizedEmail) || !safePassword) {
    throw new Error("Invalid email or password.");
  }

  const user = await User.findOne({ email: normalizedEmail });

  if (!user || !verifyPassword(safePassword, user.passwordHash)) {
    throw new Error("Invalid email or password.");
  }

  const session = await createSessionForUser(user._id);
  return {
    user: sanitizeUser(user),
    session: {
      token: session.token,
      userId: session.userId,
      createdAt: session.createdAt,
    },
  };
}

async function createSessionForUser(userId) {
  const token = createSessionToken();
  const session = await Session.create({
    token,
    userId,
  });

  return session;
}

async function getUserForToken(token) {
  if (!token) {
    return null;
  }

  const session = await Session.findOne({ token }).populate("userId");
  if (!session || !session.userId) {
    return null;
  }

  return sanitizeUser(session.userId);
}

async function invalidateSession(token) {
  if (!token) {
    return;
  }

  await Session.deleteOne({ token });
}

module.exports = {
  getUserForToken,
  invalidateSession,
  loginUser,
  registerUser,
};
