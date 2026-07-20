const { z } = require("zod");

const MAX_CHECKIN_TEXT_LENGTH = 2000;

const textAnalyzeSchema = z.object({
  text: z.string().max(
    MAX_CHECKIN_TEXT_LENGTH,
    `Check-in text must be ${MAX_CHECKIN_TEXT_LENGTH} characters or fewer.`
  ),
});

const checkinCreateSchema = z.object({
  text: z.string().max(
    MAX_CHECKIN_TEXT_LENGTH,
    `Check-in text must be ${MAX_CHECKIN_TEXT_LENGTH} characters or fewer.`
  ),
  sentiment: z.number().optional(),
  stress: z.number().optional(),
  emotion: z.string().optional(),
  risk: z.string().optional(),
  support: z.string().optional(),
  primaryEmotionKey: z.string().optional(),
  expressionLabel: z.string().optional(),
  expressionScores: z.unknown().nullable().optional(),
  safety: z.unknown().nullable().optional(),
});

const authRegisterSchema = z.object({
  name: z.string().min(1, "Name is required."),
  email: z.string().email("A valid email address is required."),
  password: z.string().min(6, "Password must be at least 6 characters."),
});

const authLoginSchema = z.object({
  email: z.string().email("A valid email address is required."),
  password: z.string().min(1, "Password is required."),
});

module.exports = {
  MAX_CHECKIN_TEXT_LENGTH,
  authLoginSchema,
  authRegisterSchema,
  checkinCreateSchema,
  textAnalyzeSchema,
};
