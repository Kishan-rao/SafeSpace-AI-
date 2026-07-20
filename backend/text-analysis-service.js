/**
 * Text emotional analysis: Groq LLM (primary) + heuristic validation layer + crisis safety overrides.
 */
const { analyzeCrisisSafety, enrichSafetyForRisk } = require("./crisis-safety-service");
const { refineGroqAnalysis } = require("./text-heuristic-validation");
const groqProvider = require("./providers/groq-provider");

// Re-export MODEL_INFO from the active provider so importers (e.g. health controller)
// automatically reflect the current provider's metadata without reaching into providers/.
const MODEL_INFO = groqProvider.MODEL_INFO;

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

/** Provider output → heuristic confidence refinement → deterministic crisis overrides. */
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
    const rawContent = await groqProvider.getCompletion(normalizedText);
    const parsed = parseGroqJson(rawContent);

    if (!parsed) {
      return buildFallbackResponse(normalizedText, "malformed-json");
    }

    const validated = validateGroqPayload(parsed);
    return finalizeAnalysis(validated, normalizedText);
  } catch (error) {
    console.error("[text-analysis] Provider analysis failed:", error.message || error);
    return buildFallbackResponse(normalizedText, "provider-error");
  }
}

module.exports = {
  MODEL_INFO,
  analyzeText,
};
