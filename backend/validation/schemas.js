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
  name: z.string(),
  email: z.string(),
  password: z.string(),
});

const authLoginSchema = z.object({
  email: z.string(),
  password: z.string(),
});

module.exports = {
  MAX_CHECKIN_TEXT_LENGTH,
  authLoginSchema,
  authRegisterSchema,
  checkinCreateSchema,
  textAnalyzeSchema,
};
