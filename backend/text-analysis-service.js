require("dotenv").config();

const Groq = require("groq-sdk");
const { analyzeCrisisSafety, enrichSafetyForRisk } = require("./crisis-safety-service");

const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const GROQ_TIMEOUT_MS = Number(process.env.GROQ_TIMEOUT_MS) || 15_000;
const GROQ_TEMPERATURE = 0.3;

const MODEL_INFO = {
  id: GROQ_MODEL,
  version: "1.0.0",
  mode: "groq-llm",
};

const EMOTION_MODEL_CATALOG = [
  { key: "calm", label: "Calm" },
  { key: "joy", label: "Joy" },
  { key: "hopeful", label: "Hopeful" },
  { key: "focused", label: "Focused" },
  { key: "neutral", label: "Neutral" },
  { key: "fatigue", label: "Fatigue" },
  { key: "sadness", label: "Sadness" },
  { key: "anxiety", label: "Anxiety" },
  { key: "stress", label: "Stress" },
  { key: "anger", label: "Anger" },
  { key: "fear", label: "Fear" },
  { key: "overwhelm", label: "Overwhelm" },
];

const EMOTION_KEYS = EMOTION_MODEL_CATALOG.map((emotion) => emotion.key);
const EMOTION_KEY_SET = new Set(EMOTION_KEYS);
const VALID_RISK_LEVELS = new Set(["Low", "Moderate", "High"]);

const DEFAULT_RECOMMENDATIONS = [
  {
    tag: "Neutral",
    title: "State check",
    text: "Pause for one minute and notice whether your body feels tense, tired, or steady right now.",
  },
  {
    tag: "Care",
    title: "Gentle reset",
    text: "Take a brief break, hydrate, and choose one small action that would make the next hour easier.",
  },
];

let groqClient = null;

function getGroqClient() {
  if (!process.env.GROQ_API_KEY) {
    return null;
  }

  if (!groqClient) {
    groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }

  return groqClient;
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(parsed, min), max);
}

function clampSignal(value) {
  return clampNumber(value, 0, 1, 0);
}

function asString(value, fallback) {
  const safe = String(value ?? "").trim();
  return safe || fallback;
}

function normalizeText(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim();
}

function getEmotionLabel(key) {
  return EMOTION_MODEL_CATALOG.find((emotion) => emotion.key === key)?.label || "Neutral";
}

function normalizeEmotionSignals(raw = {}) {
  const normalized = {};

  EMOTION_KEYS.forEach((key) => {
    normalized[key] = Number(clampSignal(raw[key]).toFixed(4));
  });

  if (Object.values(normalized).every((value) => value === 0)) {
    normalized.neutral = 1;
  }

  return normalized;
}

function resolvePrimaryEmotionKey(key, signals) {
  const candidate = asString(key, "").toLowerCase();
  if (EMOTION_KEY_SET.has(candidate)) {
    return candidate;
  }

  const ranked = Object.entries(signals).sort((a, b) => b[1] - a[1]);
  return ranked[0]?.[0] || "neutral";
}

function asRecommendationArray(value) {
  if (!Array.isArray(value)) {
    return [...DEFAULT_RECOMMENDATIONS];
  }

  const recommendations = value
    .map((item) => ({
      tag: asString(item?.tag, "Support"),
      title: asString(item?.title, "Supportive step"),
      text: asString(item?.text, "Choose one small, manageable action that supports your wellbeing right now."),
    }))
    .filter((item) => item.title && item.text)
    .slice(0, 4);

  return recommendations.length > 0 ? recommendations : [...DEFAULT_RECOMMENDATIONS];
}

function normalizeRisk(value) {
  const risk = asString(value, "Low");
  return VALID_RISK_LEVELS.has(risk) ? risk : "Low";
}

function parseGroqJson(content) {
  if (!content || typeof content !== "string") {
    return null;
  }

  let cleaned = content.trim();

  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  }

  const jsonStart = cleaned.indexOf("{");
  const jsonEnd = cleaned.lastIndexOf("}");
  if (jsonStart >= 0 && jsonEnd > jsonStart) {
    cleaned = cleaned.slice(jsonStart, jsonEnd + 1);
  }

  try {
    const parsed = JSON.parse(cleaned);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (error) {
    return null;
  }
}

function buildSystemPrompt() {
  return [
    "You are SafeSpace.ai's emotional interpretation assistant.",
    "Analyze the user's check-in text and return ONLY valid raw JSON with no markdown, code fences, or extra text.",
    "Do NOT perform crisis escalation, suicide assessment, or emergency routing.",
    "Focus on emotional interpretation, supportive language, recommendations, and emotion signal scoring.",
    "Use this exact JSON schema:",
    JSON.stringify({
      emotion: "Sadness",
      sentiment: 22,
      stress: 65,
      risk: "Moderate",
      support: "Structured support summary",
      response: "Empathetic response for the user",
      recommendations: [
        {
          tag: "Mood",
          title: "Take a short walk",
          text: "Fresh air may help regulate stress.",
        },
      ],
      emotionSignals: {
        calm: 0,
        joy: 0,
        hopeful: 0,
        focused: 0,
        neutral: 0.1,
        fatigue: 0.3,
        sadness: 0.8,
        anxiety: 0.2,
        stress: 0.1,
        anger: 0,
        fear: 0,
        overwhelm: 0.1,
      },
      primaryEmotionKey: "sadness",
    }),
    `Allowed primaryEmotionKey values: ${EMOTION_KEYS.join(", ")}.`,
    "Allowed risk values: Low, Moderate, High.",
    "sentiment and stress must be integers from 0 to 100.",
    "Each emotionSignals value must be a number from 0 to 1.",
    "recommendations must contain 1 to 4 objects with tag, title, and text.",
  ].join("\n");
}

function validateGroqPayload(raw = {}) {
  const emotionSignals = normalizeEmotionSignals(raw.emotionSignals);
  const primaryEmotionKey = resolvePrimaryEmotionKey(raw.primaryEmotionKey, emotionSignals);

  return {
    emotion: getEmotionLabel(primaryEmotionKey) || asString(raw.emotion, "Neutral"),
    sentiment: Math.round(clampNumber(raw.sentiment, 0, 100, 50)),
    stress: Math.round(clampNumber(raw.stress, 0, 100, 20)),
    risk: normalizeRisk(raw.risk),
    support: asString(raw.support, "Gentle check-in"),
    response: asString(
      raw.response,
      "Thank you for sharing this check-in. A small, supportive next step can help you feel a little steadier."
    ),
    recommendations: asRecommendationArray(raw.recommendations),
    emotionSignals,
    primaryEmotionKey,
  };
}

function applyCrisisOverrides(validated, text) {
  const safety = analyzeCrisisSafety(text, {
    sentiment: validated.sentiment,
    stress: validated.stress,
  });

  let risk = validated.risk;
  let support = validated.support;

  if (safety.level === "crisis" || safety.isCrisis) {
    risk = "High";
    support = "Immediate calming support";
  } else if (safety.level === "elevated") {
    if (risk === "Low") {
      risk = "Moderate";
    }
    if (support === "Gentle check-in" || support === "Mood maintenance") {
      support = "Structured support";
    }
  } else if (safety.level === "watch" && risk === "Low" && validated.stress >= 45) {
    risk = "Moderate";
    support = "Structured support";
  }

  if (validated.stress >= 78 || validated.sentiment <= 18) {
    risk = "High";
    support = "Immediate calming support";
  } else if (validated.stress >= 45 || validated.sentiment <= 45) {
    if (risk === "Low") {
      risk = "Moderate";
    }
    if (support === "Gentle check-in") {
      support = "Structured support";
    }
  }

  return {
    ...validated,
    emotion: getEmotionLabel(validated.primaryEmotionKey),
    risk,
    support,
    safety: enrichSafetyForRisk(safety, risk),
    model: MODEL_INFO,
  };
}

function buildEmptyTextResponse() {
  const safety = analyzeCrisisSafety("");

  return {
    emotion: "Neutral",
    sentiment: 50,
    stress: 0,
    risk: "Low",
    support: "Gentle check-in",
    response: "A quick emotional check-in will help the assistant tailor calming suggestions.",
    recommendations: [...DEFAULT_RECOMMENDATIONS],
    emotionSignals: normalizeEmotionSignals({ neutral: 1 }),
    primaryEmotionKey: "neutral",
    safety,
    model: MODEL_INFO,
  };
}

function buildFallbackResponse(text, reason = "unknown") {
  console.error(`[text-analysis] Falling back to safe defaults (${reason}).`);

  const validated = validateGroqPayload({
    emotion: "Neutral",
    sentiment: 50,
    stress: 20,
    risk: "Low",
    support: "Gentle check-in",
    response:
      "Thank you for sharing. The assistant could not complete a full analysis right now, but your check-in still matters. Consider a brief reset and reach out to someone you trust if things feel heavy.",
    recommendations: DEFAULT_RECOMMENDATIONS,
    emotionSignals: { neutral: 1 },
    primaryEmotionKey: "neutral",
  });

  return applyCrisisOverrides(validated, text);
}

async function callGroq(text) {
  const client = getGroqClient();
  if (!client) {
    throw new Error("GROQ_API_KEY is not configured.");
  }

  const completionPromise = client.chat.completions.create({
    model: GROQ_MODEL,
    temperature: GROQ_TEMPERATURE,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: buildSystemPrompt() },
      {
        role: "user",
        content: `Analyze this emotional check-in and return only JSON:\n\n${text}`,
      },
    ],
  });

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Groq request timed out after ${GROQ_TIMEOUT_MS}ms.`));
    }, GROQ_TIMEOUT_MS);
  });

  const completion = await Promise.race([completionPromise, timeoutPromise]);
  const content = completion?.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("Groq returned an empty completion.");
  }

  return content;
}

async function analyzeText(text) {
  const normalizedText = normalizeText(text);

  if (!normalizedText) {
    return buildEmptyTextResponse();
  }

  try {
    const rawContent = await callGroq(normalizedText);
    const parsed = parseGroqJson(rawContent);

    if (!parsed) {
      return buildFallbackResponse(normalizedText, "malformed-json");
    }

    const validated = validateGroqPayload(parsed);
    return applyCrisisOverrides(validated, normalizedText);
  } catch (error) {
    console.error("[text-analysis] Groq analysis failed:", error.message || error);
    return buildFallbackResponse(normalizedText, "groq-error");
  }
}

module.exports = {
  MODEL_INFO,
  analyzeText,
};
