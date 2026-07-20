const assert = require("node:assert/strict");
const test = require("node:test");
const {
  textAnalyzeSchema,
  checkinCreateSchema,
  authRegisterSchema,
  authLoginSchema,
  MAX_CHECKIN_TEXT_LENGTH,
} = require("../validation/schemas");

test("textAnalyzeSchema validates text length", () => {
  assert.equal(textAnalyzeSchema.safeParse({ text: "Hello world" }).success, true);
  assert.equal(textAnalyzeSchema.safeParse({ text: "" }).success, true);

  const longText = "a".repeat(MAX_CHECKIN_TEXT_LENGTH + 1);
  const result = textAnalyzeSchema.safeParse({ text: longText });
  assert.equal(result.success, false);
  assert.match(result.error.issues[0].message, /2000 characters or fewer/);
});

test("checkinCreateSchema validates optional fields and max text length", () => {
  const validPayload = {
    text: "Valid checkin text",
    sentiment: 75,
    stress: 20,
    emotion: "Joy",
    risk: "Low",
  };
  assert.equal(checkinCreateSchema.safeParse(validPayload).success, true);

  const tooLong = { text: "b".repeat(MAX_CHECKIN_TEXT_LENGTH + 1) };
  assert.equal(checkinCreateSchema.safeParse(tooLong).success, false);
});

test("authRegisterSchema requires name, valid email, and min 6-char password", () => {
  const valid = { name: "Test User", email: "user@example.com", password: "password123" };
  assert.equal(authRegisterSchema.safeParse(valid).success, true);

  // Invalid email
  const badEmail = { name: "Test User", email: "notanemail", password: "password123" };
  assert.equal(authRegisterSchema.safeParse(badEmail).success, false);

  // Empty name
  const emptyName = { name: "", email: "user@example.com", password: "password123" };
  assert.equal(authRegisterSchema.safeParse(emptyName).success, false);

  // Short password
  const shortPass = { name: "Test User", email: "user@example.com", password: "123" };
  assert.equal(authRegisterSchema.safeParse(shortPass).success, false);
});

test("authLoginSchema requires valid email and non-empty password", () => {
  const valid = { email: "user@example.com", password: "secretpassword" };
  assert.equal(authLoginSchema.safeParse(valid).success, true);

  const badEmail = { email: "bademail", password: "password" };
  assert.equal(authLoginSchema.safeParse(badEmail).success, false);

  const emptyPass = { email: "user@example.com", password: "" };
  assert.equal(authLoginSchema.safeParse(emptyPass).success, false);
});
