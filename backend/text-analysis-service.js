/**
 * Text emotional analysis: Groq LLM (primary) + heuristic validation layer + crisis safety overrides.
 */
const Groq = require("groq-sdk");
const { analyzeCrisisSafety, enrichSafetyForRisk } = require("./crisis-safety-service");
const { refineGroqAnalysis } = require("./text-heuristic-validation");

const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const GROQ_TIMEOUT_MS = Number(process.env.GROQ_TIMEOUT_MS) || 15_000;
const GROQ_TEMPERATURE = 0.3;
const GROQ_MAX_RETRIES = 2; // retry once on transient errors (429, 503)

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

const EMOTION_KEYS = EMOTION_MODEL_CATALOG.map((e) => e.key);
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

// ---------------------------------------------------------------------------
// Groq client — lazy singleton
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
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
  return EMOTION_MODEL_CATALOG.find((e) => e.key === key)?.label || "Neutral";
}

/**
 * Clamp each signal to [0,1], then sum-normalise so the distribution is
 * always a proper probability simplex (values sum to 1).  This prevents
 * Groq returning un-normalised weights (e.g. sadness:0.8, anxiety:0.8)
 * from inflating multiple emotions simultaneously and corrupting ranking.
 */
function normalizeEmotionSignals(raw = {}) {
  const clamped = {};
  EMOTION_KEYS.forEach((key) => {
    clamped[key] = clampSignal(raw[key]);
  });

  const total = Object.values(clamped).reduce((s, v) => s + v, 0);

  if (total === 0) {
    // No signal at all — default to neutral
    clamped.neutral = 1;
    return clamped;
  }

  if (total > 1.05) {
    // Unnormalised — rescale to sum=1
    const normalised = {};
    EMOTION_KEYS.forEach((key) => {
      normalised[key] = Number((clamped[key] / total).toFixed(4));
    });
    return normalised;
  }

  // Already a valid simplex — just round
  const rounded = {};
  EMOTION_KEYS.forEach((key) => {
    rounded[key] = Number(clamped[key].toFixed(4));
  });
  return rounded;
}

function resolvePrimaryEmotionKey(key, signals) {
  const candidate = asString(key, "").toLowerCase();
  if (EMOTION_KEY_SET.has(candidate)) return candidate;

  return Object.entries(signals).sort((a, b) => b[1] - a[1])[0]?.[0] || "neutral";
}

function asRecommendationArray(value) {
  if (!Array.isArray(value)) return [...DEFAULT_RECOMMENDATIONS];

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

/**
 * Robustly extract a JSON object from a Groq completion that may include
 * markdown fences, leading prose, or trailing text.
 */
function parseGroqJson(content) {
  if (!content || typeof content !== "string") return null;

  let cleaned = content.trim();

  // Strip markdown code fences
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

  // Find the outermost JSON object using brace depth tracking (handles nested objects)
  let depth = 0;
  let start = -1;
  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i] === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (cleaned[i] === "}") {
      depth--;
      if (depth === 0 && start !== -1) {
        const candidate = cleaned.slice(start, i + 1);
        try {
          const parsed = JSON.parse(candidate);
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            return parsed;
          }
        } catch {
          // Try next outermost object
          start = -1;
        }
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// System prompt — example uses sum-normalised emotionSignals (sum ≈ 1.0)
// ---------------------------------------------------------------------------

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
        calm: 0.0,
        joy: 0.0,
        hopeful: 0.0,
        focused: 0.0,
        neutral: 0.05,
        fatigue: 0.2,
        sadness: 0.45,
        anxiety: 0.15,
        stress: 0.1,
        anger: 0.0,
        fear: 0.0,
        overwhelm: 0.05,
      },
      primaryEmotionKey: "sadness",
    }),
    `Allowed primaryEmotionKey values: ${EMOTION_KEYS.join(", ")}.`,
    "Allowed risk values: Low, Moderate, High.",
    "sentiment and stress must be integers from 0 to 100.",
    "Each emotionSignals value must be a decimal from 0 to 1, and all values must sum to approximately 1.0.",
    "recommendations must contain 1 to 4 objects with tag, title, and text.",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Payload validation
// ---------------------------------------------------------------------------

function validateGroqPayload(raw = {}) {
  const emotionSignals = normalizeEmotionSignals(raw.emotionSignals);
  const primaryEmotionKey = resolvePrimaryEmotionKey(raw.primaryEmotionKey, emotionSignals);

  return {
    emotion: getEmotionLabel(primaryEmotionKey),
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

// ---------------------------------------------------------------------------
// Crisis safety overrides — single coherent resolution pass
// ---------------------------------------------------------------------------

function applyCrisisSafetyOverrides(validated, text) {
  const safety = analyzeCrisisSafety(text, {
    sentiment: validated.sentiment,
    stress: validated.stress,
  });

  let risk = validated.risk;
  let support = validated.support;

  // Priority 1: Explicit crisis signals always win
  if (safety.isCrisis || safety.level === "crisis") {
    risk = "High";
    support = "Immediate calming support";
  } else {
    // Priority 2: Numeric thresholds (deterministic guardrails)
    if (validated.stress >= 78 || validated.sentiment <= 18) {
      risk = "High";
      support = "Immediate calming support";
    } else if (validated.stress >= 45 || validated.sentiment <= 45) {
      if (risk === "Low") risk = "Moderate";
      if (support === "Gentle check-in") support = "Structured support";
    }

    // Priority 3: Safety-level from crisis service (only escalates, never de-escalates)
    if (safety.level === "elevated") {
      if (risk === "Low") risk = "Moderate";
      if (support === "Gentle check-in" || support === "Mood maintenance") support = "Structured support";
    } else if (safety.level === "watch" && risk === "Low" && validated.stress >= 45) {
      risk = "Moderate";
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

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

/** Groq output → heuristic confidence refinement → deterministic crisis overrides. */
function finalizeAnalysis(validated, text) {
  const refined = refineGroqAnalysis(validated, text);
  return applyCrisisSafetyOverrides(refined, text);
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

  // Wrap heuristic layer in its own try/catch — if it also fails, still return safe result
  try {
    return finalizeAnalysis(validated, text);
  } catch (heuristicError) {
    console.error("[text-analysis] Heuristic layer also failed in fallback:", heuristicError.message);
    return applyCrisisSafetyOverrides(validated, text);
  }
}

// ---------------------------------------------------------------------------
// Groq API call with retry on transient errors
// ---------------------------------------------------------------------------

function isRetryableError(error) {
  const status = error?.status ?? error?.statusCode;
  if (status === 429 || status === 503) return true;
  const msg = String(error?.message || "").toLowerCase();
  return msg.includes("rate limit") || msg.includes("service unavailable") || msg.includes("timeout");
}

async function callGroqOnce(text) {
  const client = getGroqClient();
  if (!client) {
    throw new Error("GROQ_API_KEY is not configured.");
  }

  const controller = new AbortController();
  let timeoutHandle;

  try {
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
    }, { signal: controller.signal });

    const timeoutPromise = new Promise((_, reject) => {
      timeoutHandle = setTimeout(() => {
        controller.abort();
        reject(new Error(`Groq request timed out after ${GROQ_TIMEOUT_MS}ms.`));
      }, GROQ_TIMEOUT_MS);
    });

    const completion = await Promise.race([completionPromise, timeoutPromise]);
    const content = completion?.choices?.[0]?.message?.content;

    if (!content) throw new Error("Groq returned an empty completion.");

    return content;
  } finally {
    clearTimeout(timeoutHandle);
  }
}

async function callGroq(text) {
  let lastError;

  for (let attempt = 0; attempt <= GROQ_MAX_RETRIES; attempt++) {
    try {
      return await callGroqOnce(text);
    } catch (error) {
      lastError = error;
      if (attempt < GROQ_MAX_RETRIES && isRetryableError(error)) {
        const delay = 800 * Math.pow(2, attempt); // 800ms, 1600ms
        console.warn(`[text-analysis] Groq transient error (attempt ${attempt + 1}), retrying in ${delay}ms:`, error.message);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        break;
      }
    }
  }

  throw lastError;
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

async function analyzeText(text) {
  const normalizedText = normalizeText(text);

  if (!normalizedText) {
    return buildEmptyTextResponse();
  }

  if (!process.env.GROQ_API_KEY) {
    return buildFallbackResponse(normalizedText, "missing-api-key");
  }

  try {
    const rawContent = await callGroq(normalizedText);
    const parsed = parseGroqJson(rawContent);

    if (!parsed) {
      return buildFallbackResponse(normalizedText, "malformed-json");
    }

    const validated = validateGroqPayload(parsed);
    return finalizeAnalysis(validated, normalizedText);
  } catch (error) {
    console.error("[text-analysis] Groq analysis failed:", error.message || error);
    return buildFallbackResponse(normalizedText, "groq-error");
  }
}

module.exports = {
  MODEL_INFO,
  analyzeText,
};
