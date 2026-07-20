/**
 * Groq implementation of the LLMProvider interface.
 * @see ../providers/llm-provider.js for the interface contract.
 */
const Groq = require("groq-sdk");

const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const GROQ_TIMEOUT_MS = Number(process.env.GROQ_TIMEOUT_MS) || 15_000;
const GROQ_TEMPERATURE = 0.3;
const GROQ_MAX_RETRIES = 2; // retry once on transient errors (429, 503)

const MODEL_INFO = {
  id: GROQ_MODEL,
  version: "1.0.0",
  mode: "groq-llm",
};

// Allowed primaryEmotionKey values — must stay in sync with EMOTION_MODEL_CATALOG
// in text-analysis-service.js. Listed here only to build the system prompt.
const EMOTION_KEYS = [
  "calm", "joy", "hopeful", "focused", "neutral",
  "fatigue", "sadness", "anxiety", "stress", "anger", "fear", "overwhelm",
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
// Retry helpers
// ---------------------------------------------------------------------------

function isRetryableError(error) {
  const status = error?.status ?? error?.statusCode;
  if (status === 429 || status === 503) return true;
  const msg = String(error?.message || "").toLowerCase();
  return msg.includes("rate limit") || msg.includes("service unavailable") || msg.includes("timeout");
}

// ---------------------------------------------------------------------------
// Network calls
// ---------------------------------------------------------------------------

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
        console.warn(`[groq-provider] Groq transient error (attempt ${attempt + 1}), retrying in ${delay}ms:`, error.message);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        break;
      }
    }
  }

  throw lastError;
}

// ---------------------------------------------------------------------------
// LLMProvider interface implementation
// ---------------------------------------------------------------------------

/**
 * @param {string} text Normalised check-in text.
 * @returns {Promise<string>} Raw JSON completion string from Groq.
 */
async function getCompletion(text) {
  return callGroq(text);
}

module.exports = { getCompletion, MODEL_INFO };
