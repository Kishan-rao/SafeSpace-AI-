const crypto = require("crypto");
const { promisify } = require("util");
const User = require("./models/User");
const Session = require("./models/Session");

const scrypt = promisify(crypto.scrypt);

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

async function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const derivedKey = await scrypt(password, salt, 64);
  return `${salt}:${derivedKey.toString("hex")}`;
}

async function verifyPassword(password, storedHash) {
  const [salt, expected] = String(storedHash || "").split(":");
  if (!salt || !expected) {
    return false;
  }

  const derivedKey = await scrypt(password, salt, 64);
  const derivedBuffer = Buffer.from(derivedKey);
  const expectedBuffer = Buffer.from(expected, "hex");

  if (derivedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(derivedBuffer, expectedBuffer);
}

function createSessionToken() {
  return crypto.randomBytes(32).toString("hex");
}

function hashSessionToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function buildSessionResponse(session, token) {
  return {
    token,
    userId: session.document.userId,
    createdAt: session.document.createdAt,
  };
}

/*
 * Kept as a local helper so session lookup can use tokenHash when available
 * while still supporting the existing unique token index.
 */
function buildSessionLookup(token) {
  return {
    $or: [{ tokenHash: hashSessionToken(token) }, { token }],
  };
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
      passwordHash: await hashPassword(safePassword),
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
    session: buildSessionResponse(session, session.token),
  };
}

async function loginUser({ email, password }) {
  const normalizedEmail = normalizeEmail(email);
  const safePassword = String(password || "");

  if (!isValidEmail(normalizedEmail) || !safePassword) {
    throw new Error("Invalid email or password.");
  }

  const user = await User.findOne({ email: normalizedEmail });

  if (!user || !(await verifyPassword(safePassword, user.passwordHash))) {
    throw new Error("Invalid email or password.");
  }

  const session = await createSessionForUser(user._id);
  return {
    user: sanitizeUser(user),
    session: buildSessionResponse(session, session.token),
  };
}

async function createSessionForUser(userId) {
  const token = createSessionToken();
  const document = await Session.create({
    token,
    tokenHash: hashSessionToken(token),
    userId,
  });

  return { document, token };
}

async function getUserForToken(token) {
  if (!token) {
    return null;
  }

  const session = await Session.findOne(buildSessionLookup(token)).populate("userId");
  if (!session || !session.userId) {
    return null;
  }

  return sanitizeUser(session.userId);
}

async function invalidateSession(token) {
  if (!token) {
    return;
  }

  await Session.deleteOne(buildSessionLookup(token));
}

module.exports = {
  getUserForToken,
  invalidateSession,
  loginUser,
  registerUser,
};
