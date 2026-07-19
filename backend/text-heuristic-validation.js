/**
 * Heuristic NLP validation layer for text check-ins.
 * Scores lexical confidence and refines Groq output — not a standalone analyzer.
 */

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

const POSITIVE_EMOTION_KEYS = new Set(["calm", "joy", "hopeful", "focused"]);
const CHALLENGING_EMOTION_KEYS = new Set([
  "fatigue",
  "sadness",
  "anxiety",
  "stress",
  "anger",
  "fear",
  "overwhelm",
]);

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

function normalizeText(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTextForMatching(text) {
  return normalizeText(text)
    .toLowerCase()
    .replace(/[^\w\s'-]/g, " ");
}

function getEmotionLabel(key) {
  return EMOTION_MODEL_CATALOG.find((e) => e.key === key)?.label || "Neutral";
}

/**
 * Clamp each signal to [0,1], then sum-normalise so signals always form
 * a probability simplex.  Mirrors the fix in text-analysis-service.js.
 */
function normalizeEmotionSignals(raw = {}) {
  const clamped = {};
  EMOTION_KEYS.forEach((key) => {
    clamped[key] = clampSignal(raw[key]);
  });

  const total = Object.values(clamped).reduce((s, v) => s + v, 0);

  if (total === 0) {
    clamped.neutral = 1;
    return clamped;
  }

  if (total > 1.05) {
    const normalised = {};
    EMOTION_KEYS.forEach((key) => {
      normalised[key] = Number((clamped[key] / total).toFixed(4));
    });
    return normalised;
  }

  const rounded = {};
  EMOTION_KEYS.forEach((key) => {
    rounded[key] = Number(clamped[key].toFixed(4));
  });
  return rounded;
}

function resolvePrimaryEmotionKey(key, signals) {
  const candidate = String(key ?? "").trim().toLowerCase();
  if (EMOTION_KEY_SET.has(candidate)) return candidate;
  return Object.entries(signals).sort((a, b) => b[1] - a[1])[0]?.[0] || "neutral";
}

// ---------------------------------------------------------------------------
// Lexicons
// ---------------------------------------------------------------------------

const STRONG_POSITIVE_PHRASES = [
  "amazing",
  "best day",
  "cloud nine",
  "delighted",
  "elated",
  "extremely great",
  "fantastic",
  "great",
  "happy",
  "joyful",
  "proud",
  "thrilled",
];

const DISTRESS_GUARD_PHRASES = [
  "anxious",
  "can't cope",
  "cannot cope",
  "depressed",
  "hopeless",
  "panic",
  "self harm",
  "self-harm",
  "suicidal",
  "want to die",
  "worthless",
];

const TEXT_EMOTION_EVIDENCE = {
  calm: [
    { phrase: "calm", weight: 0.7 },
    { phrase: "grounded", weight: 0.65 },
    { phrase: "peaceful", weight: 0.65 },
    { phrase: "relaxed", weight: 0.65 },
    { phrase: "settled", weight: 0.6 },
    { phrase: "steady", weight: 0.55 },
  ],
  joy: [
    { phrase: "amazing", weight: 0.65 },
    { phrase: "best day", weight: 0.75 },
    { phrase: "cloud nine", weight: 0.75 },
    { phrase: "delighted", weight: 0.7 },
    { phrase: "elated", weight: 0.75 },
    { phrase: "excited", weight: 0.6 },
    { phrase: "fantastic", weight: 0.65 },
    { phrase: "great", weight: 0.55 },
    { phrase: "happy", weight: 0.7 },
    { phrase: "joy", weight: 0.7 },
    { phrase: "joyful", weight: 0.75 },
    { phrase: "proud", weight: 0.55 },
    { phrase: "thrilled", weight: 0.7 },
  ],
  hopeful: [
    { phrase: "better", weight: 0.45 },
    { phrase: "confident", weight: 0.6 },
    { phrase: "hopeful", weight: 0.75 },
    { phrase: "improving", weight: 0.6 },
    { phrase: "motivated", weight: 0.6 },
    { phrase: "optimistic", weight: 0.75 },
  ],
  focused: [
    { phrase: "clear", weight: 0.5 },
    { phrase: "engaged", weight: 0.55 },
    { phrase: "focused", weight: 0.75 },
    { phrase: "organized", weight: 0.6 },
    { phrase: "productive", weight: 0.7 },
  ],
  fatigue: [
    { phrase: "ambitionless", weight: 0.75 },
    { phrase: "burned out", weight: 0.65 },
    { phrase: "burnt out", weight: 0.65 },
    { phrase: "drained", weight: 0.6 },
    { phrase: "exhausted", weight: 0.7 },
    { phrase: "fatigue", weight: 0.7 },
    { phrase: "getting harder", weight: 0.55 },
    { phrase: "going nowhere", weight: 0.6 },
    { phrase: "lethargic", weight: 0.65 },
    { phrase: "lost motivation", weight: 0.65 },
    { phrase: "low energy", weight: 0.55 },
    { phrase: "low motivation", weight: 0.55 },
    { phrase: "low on motivation", weight: 0.55 },
    { phrase: "no drive", weight: 0.6 },
    { phrase: "no motivation", weight: 0.6 },
    { phrase: "no purpose", weight: 0.65 },
    { phrase: "pointless", weight: 0.6 },
    { phrase: "tired", weight: 0.55 },
    { phrase: "unmotivated", weight: 0.6 },
  ],
  sadness: [
    { phrase: "depressed", weight: 0.8 },
    { phrase: "depression", weight: 0.8 },
    { phrase: "disconnected", weight: 0.5 },
    { phrase: "empty", weight: 0.65 },
    { phrase: "falling apart", weight: 0.75 },
    { phrase: "feel like a failure", weight: 0.8 },
    { phrase: "feel useless", weight: 0.75 },
    { phrase: "feel worthless", weight: 0.8 },
    { phrase: "getting harder", weight: 0.5 },
    { phrase: "good for nothing", weight: 0.75 },
    { phrase: "hopeless", weight: 0.75 },
    { phrase: "i hate myself", weight: 0.85 },
    { phrase: "i'm a failure", weight: 0.85 },
    { phrase: "i'm nothing", weight: 0.8 },
    { phrase: "im a failure", weight: 0.85 },
    { phrase: "im nothing", weight: 0.8 },
    { phrase: "life is hard", weight: 0.6 },
    { phrase: "life is getting harder", weight: 0.7 },
    { phrase: "lost myself", weight: 0.65 },
    { phrase: "low mood", weight: 0.7 },
    { phrase: "low on motivation", weight: 0.45 },
    { phrase: "no good", weight: 0.55 },
    { phrase: "not good enough", weight: 0.7 },
    { phrase: "piece of shit", weight: 0.85 },
    { phrase: "sad", weight: 0.7 },
    { phrase: "unhappy", weight: 0.65 },
    { phrase: "unmotivated", weight: 0.45 },
    { phrase: "used to be better", weight: 0.6 },
    { phrase: "used to be good", weight: 0.55 },
    { phrase: "worthless", weight: 0.8 },
  ],
  anxiety: [
    { phrase: "anxious", weight: 0.75 },
    { phrase: "nervous", weight: 0.6 },
    { phrase: "panic", weight: 0.8 },
    { phrase: "restless", weight: 0.55 },
    { phrase: "worried", weight: 0.65 },
  ],
  stress: [
    { phrase: "burnout", weight: 0.65 },
    { phrase: "deadline", weight: 0.5 },
    { phrase: "harder and harder", weight: 0.6 },
    { phrase: "pressure", weight: 0.55 },
    { phrase: "stressed", weight: 0.75 },
    { phrase: "tense", weight: 0.55 },
  ],
  anger: [
    { phrase: "angry", weight: 0.75 },
    { phrase: "annoyed", weight: 0.55 },
    { phrase: "frustrated", weight: 0.65 },
    { phrase: "furious", weight: 0.8 },
    { phrase: "irritated", weight: 0.6 },
    { phrase: "pissed off", weight: 0.7 },
    { phrase: "upset", weight: 0.5 },
  ],
  fear: [
    { phrase: "afraid", weight: 0.7 },
    { phrase: "fear", weight: 0.7 },
    { phrase: "scared", weight: 0.7 },
    { phrase: "terrified", weight: 0.8 },
    { phrase: "unsafe", weight: 0.75 },
  ],
  overwhelm: [
    { phrase: "can't cope", weight: 0.75 },
    { phrase: "cannot cope", weight: 0.75 },
    { phrase: "drowning", weight: 0.75 },
    { phrase: "everything is falling", weight: 0.7 },
    { phrase: "it's too much", weight: 0.7 },
    { phrase: "its too much", weight: 0.7 },
    { phrase: "overwhelmed", weight: 0.8 },
    { phrase: "too much", weight: 0.6 },
  ],
};

const EMOTION_PROTOTYPES = {
  calm: "steady grounded settled peaceful breathing relaxed safe centered composed slow",
  joy: "happy joyful delighted excited grateful smiling optimistic bright wonderful amazing uplifted happiness",
  hopeful: "hopeful encouraged improving progress healing resilient optimistic tomorrow can manage",
  focused: "focused clear productive organized prepared engaged discipline momentum on track",
  neutral: "okay fine normal manageable stable average ordinary balanced",
  fatigue: "tired exhausted drained sleepy worn burnout low energy depleted foggy ambitionless lethargic pointless no drive lost purpose",
  sadness: "sad lonely empty hopeless tearful hurt down numb grieving depressed worthless failure useless broken lost unhappy miserable",
  anxiety: "anxious nervous restless racing thoughts panic overthinking uneasy on edge worried",
  stress: "stressed pressure deadlines overloaded tense strained workload demand crunch harder",
  anger: "angry frustrated irritated annoyed resentful furious upset unfair conflict",
  fear: "afraid scared fearful unsafe dread terrified vulnerable threatened uncertain",
  overwhelm: "overwhelmed flooded too much cannot cope cant cope drowning spiraling overloaded stuck",
};

const TOKEN_WEIGHTS = {
  amazing: 2.4,
  ambitionless: -2.5,
  angry: -2.4,
  annoyed: -1.8,
  anxious: -2.3,
  broken: -2.2,
  burnout: -2.4,
  calm: 2.2,
  confident: 2.1,
  cope: -0.6,
  deadline: -1.4,
  deadlines: -1.7,
  delighted: 2.3,
  depressed: -2.8,
  disconnected: -1.5,
  drained: -2.1,
  empty: -2.6,
  exhausted: -2.4,
  failure: -2.6,
  fine: 0.2,
  focused: 1.7,
  frustrated: -2.1,
  furious: -2.8,
  grateful: 2.0,
  grounded: 1.8,
  happiness: 2.4,
  happy: 2.2,
  harder: -1.6,
  hopeless: -3.1,
  hurt: -1.9,
  irritated: -2.0,
  joy: 2.5,
  lethargic: -2.0,
  lonely: -2.3,
  lost: -1.8,
  low: -0.9,
  manageable: 0.8,
  miserable: -2.7,
  nervous: -1.9,
  numb: -2.3,
  okay: 0.4,
  overwhelmed: -2.8,
  panic: -3.0,
  peaceful: 2.0,
  pointless: -2.3,
  pressure: -1.9,
  productive: 1.3,
  progress: 1.2,
  racing: -1.1,
  relaxed: 1.8,
  restless: -1.7,
  sad: -2.3,
  safe: 1.4,
  scared: -2.4,
  shit: -2.8,
  steady: 1.5,
  stressed: -2.5,
  stuck: -1.9,
  support: 0.9,
  tired: -1.8,
  unhappy: -2.2,
  unsafe: -3.1,
  useless: -2.7,
  worried: -2.0,
  worthless: -3.2,
};

const PHRASE_WEIGHTS = {
  "at peace": 2.2,
  "burned out": -2.6,
  "cannot cope": -3.2,
  "can't cope": -3.2,
  "feel okay": 0.9,
  "getting harder and harder": -2.8,
  "hard to switch off": -1.8,
  "hate myself": -3.4,
  "life is getting harder": -2.5,
  "low mood": -2.2,
  "mental overload": -2.4,
  "no reason to": -2.0,
  "not good enough": -2.4,
  "not sleeping": -1.8,
  "on edge": -2.0,
  "panic attack": -3.3,
  "piece of shit": -3.8,
  "racing thoughts": -2.5,
  "self harm": -4.4,
  "used to be better": -2.0,
  "used to be good": -1.8,
  "want to die": -5.0,
  "what's the point": -2.6,
  "whats the point": -2.6,
};

const NEGATORS = new Set(["no", "not", "never", "hardly", "barely", "cannot", "cant", "don't", "dont", "isn't", "isnt"]);
const INTENSIFIERS = new Set(["very", "really", "extremely", "deeply", "totally", "so", "super", "severely"]);

// ---------------------------------------------------------------------------
// Text processing
// ---------------------------------------------------------------------------

function countPhraseMatches(normalizedText, phrases) {
  return phrases.filter((phrase) => normalizedText.includes(phrase)).length;
}

function maxSignalForKeys(signals, keys) {
  return Math.max(...[...keys].map((key) => Number(signals[key]) || 0));
}

function tokenizeForValidation(text) {
  return normalizeTextForMatching(text).split(" ").filter(Boolean);
}

/**
 * Light rule-based stemmer. Applied once to input tokens.
 * Prototype strings are tokenized fresh each call, so stems are NOT
 * double-applied to prototype tokens.
 */
function simpleStem(token) {
  let s = token;
  if (s.endsWith("iness")) return s.slice(0, -5) + "y";
  if (s.endsWith("ness")) return s.slice(0, -4);
  return s
    .replace(/'s$/, "")
    .replace(/ing$/, "")
    .replace(/ed$/, "")
    .replace(/ly$/, "")
    .replace(/ies$/, "y")
    .replace(/s$/, "");
}

function buildVectorFromRawTokens(rawTokens) {
  // Stem once here — prototype tokens are not pre-stemmed
  return rawTokens.reduce((vector, token) => {
    const stemmed = simpleStem(token);
    vector[stemmed] = (vector[stemmed] || 0) + 1;
    return vector;
  }, {});
}

function dotProduct(left, right) {
  return Object.keys(left).reduce((total, key) => total + (left[key] || 0) * (right[key] || 0), 0);
}

function magnitude(vector) {
  return Math.sqrt(Object.values(vector).reduce((sum, v) => sum + v * v, 0));
}

function cosineSimilarity(left, right) {
  const denom = magnitude(left) * magnitude(right);
  return denom ? dotProduct(left, right) / denom : 0;
}

/**
 * Build prototype emotion signals via cosine similarity.
 * Input tokens are already stemmed; prototype tokens are raw and stemmed
 * internally by buildVectorFromRawTokens — no double-stemming.
 */
function buildPrototypeEmotionSignals(stemmedTokens) {
  // Build document vector from stemmed input tokens (already stemmed once)
  const docVector = stemmedTokens.reduce((vector, token) => {
    vector[token] = (vector[token] || 0) + 1;
    return vector;
  }, {});

  const signals = {};

  EMOTION_MODEL_CATALOG.forEach((emotion) => {
    // Prototype tokens are raw — stem them once here
    const prototypeRawTokens = tokenizeForValidation(EMOTION_PROTOTYPES[emotion.key] || "");
    const prototypeVector = buildVectorFromRawTokens(prototypeRawTokens);
    const similarity = cosineSimilarity(docVector, prototypeVector);
    const directHits = stemmedTokens.reduce((total, token) => total + (prototypeVector[token] || 0), 0);
    signals[emotion.key] = Number((similarity * 5.2 + directHits * 0.22).toFixed(4));
  });

  return normalizeEmotionSignals(signals);
}

/**
 * Safe phrase match — escapes regex special chars for single-word phrases.
 */
function hasPhraseMatch(normalizedText, phrase) {
  if (phrase.includes(" ") || phrase.includes("-") || phrase.includes("'")) {
    return normalizedText.includes(phrase);
  }
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|\\s)${escaped}(\\s|$)`).test(normalizedText);
}

function scoreTextEmotionEvidence(text) {
  const normalizedText = normalizeTextForMatching(text);

  return Object.fromEntries(
    Object.entries(TEXT_EMOTION_EVIDENCE).map(([emotionKey, patterns]) => {
      const score = patterns.reduce(
        (sum, pattern) => (hasPhraseMatch(normalizedText, pattern.phrase) ? sum + pattern.weight : sum),
        0
      );
      return [emotionKey, Number(clampSignal(score).toFixed(4))];
    })
  );
}

function dampenContradictoryPositiveSignals(emotionSignals, context) {
  const sentiment = Number(context.sentiment) || 0;
  const stress = Number(context.stress) || 0;
  const highDistress = context.risk === "High" || stress >= 70 || sentiment <= 25;
  const moderateDistress = context.risk === "Moderate" || stress >= 45 || sentiment <= 42;
  const hasExplicitPositiveLanguage = context.positiveHits > 0;
  const multiplier = highDistress ? (hasExplicitPositiveLanguage ? 0.35 : 0) : moderateDistress ? 0.35 : 1;

  if (multiplier === 1) return emotionSignals;

  const adjusted = { ...emotionSignals };
  POSITIVE_EMOTION_KEYS.forEach((key) => {
    adjusted[key] = Number(((adjusted[key] || 0) * multiplier).toFixed(4));
  });
  return adjusted;
}

function getRankedSignals(signals) {
  return Object.entries(signals).sort((a, b) => b[1] - a[1]);
}

function getDominantEmotionKey(signals) {
  return getRankedSignals(signals)[0]?.[0] || "neutral";
}

function scoreSignalConfidence(signals) {
  const ranked = getRankedSignals(signals);
  const top = ranked[0]?.[1] || 0;
  const second = ranked[1]?.[1] || 0;
  const margin = Math.max(top - second, 0);
  return Math.round(clampNumber(30 + top * 42 + margin * 38, 0, 100, 30));
}

// ---------------------------------------------------------------------------
// Heuristic validation pass
// ---------------------------------------------------------------------------

function buildHeuristicValidation(text) {
  const normalizedText = normalizeTextForMatching(text);
  const rawTokens = tokenizeForValidation(normalizedText);
  // Stem input tokens once — used for prototype comparison and token weight lookup
  const stemmedTokens = rawTokens.map(simpleStem);
  const evidence = scoreTextEmotionEvidence(text);
  let emotionSignals = buildPrototypeEmotionSignals(stemmedTokens);
  let valenceTotal = 0;
  let stressSignal = 0;
  let positiveHits = 0;
  let negativeHits = 0;

  stemmedTokens.forEach((token, index) => {
    const weight = TOKEN_WEIGHTS[token] || 0;
    if (!weight) return;

    const prev = stemmedTokens[index - 1];
    const prev2 = stemmedTokens[index - 2];
    const isNegated = NEGATORS.has(prev) || NEGATORS.has(prev2);
    const isIntensified = INTENSIFIERS.has(prev) || INTENSIFIERS.has(prev2);
    let adjusted = weight;
    if (isNegated) adjusted *= -0.7;
    if (isIntensified) adjusted *= 1.4;

    valenceTotal += adjusted;
    if (adjusted > 0) {
      positiveHits += 1;
    } else {
      negativeHits += 1;
      stressSignal += Math.abs(adjusted);
    }
  });

  Object.entries(PHRASE_WEIGHTS).forEach(([phrase, weight]) => {
    if (!normalizedText.includes(phrase)) return;
    valenceTotal += weight;
    if (weight < 0) {
      stressSignal += Math.abs(weight) * 0.9;
      negativeHits += 1;
    } else {
      positiveHits += 1;
    }
  });

  Object.entries(evidence).forEach(([emotionKey, score]) => {
    if (score > 0) {
      emotionSignals[emotionKey] = Math.max(Number(emotionSignals[emotionKey]) || 0, score);
    }
  });

  const severeHits = countPhraseMatches(normalizedText, DISTRESS_GUARD_PHRASES);
  const tokenVolume = clampNumber(stemmedTokens.length / 36, 0, 1.8, 0);

  const sentiment = Math.round(
    clampNumber(
      50 +
        valenceTotal * 8.8 +
        (emotionSignals.joy || 0) * 3.4 +
        (emotionSignals.hopeful || 0) * 2.8 -
        (emotionSignals.sadness || 0) * 4.6 -
        (emotionSignals.anxiety || 0) * 4.2,
      0,
      100,
      50
    )
  );

  const stress = Math.round(
    clampNumber(
      8 +
        stressSignal * 8.4 +
        (emotionSignals.stress || 0) * 7.2 +
        (emotionSignals.overwhelm || 0) * 7.8 +
        (emotionSignals.anxiety || 0) * 6.6 +
        severeHits * 14 +
        tokenVolume * 10 -
        (emotionSignals.calm || 0) * 5.6 -
        (emotionSignals.focused || 0) * 2.2,
      0,
      100,
      20
    )
  );

  const inferredRisk =
    severeHits > 0 || stress >= 78 || sentiment <= 18
      ? "High"
      : stress >= 45 || sentiment <= 45 || negativeHits > positiveHits + 1
        ? "Moderate"
        : "Low";

  emotionSignals = dampenContradictoryPositiveSignals(emotionSignals, {
    sentiment,
    stress,
    risk: inferredRisk,
    positiveHits,
  });

  const primaryEmotionKey = getDominantEmotionKey(emotionSignals);
  const rankedEvidence = getRankedSignals(evidence);
  const topEvidenceScore = rankedEvidence[0]?.[1] || 0;
  const lexicalHits = positiveHits + negativeHits + Object.values(evidence).filter((s) => s > 0).length;
  const confidence = Math.round(
    clampNumber(
      scoreSignalConfidence(emotionSignals) + Math.min(lexicalHits * 6, 24) + topEvidenceScore * 16,
      0,
      100,
      40
    )
  );

  return {
    confidence,
    emotionSignals: normalizeEmotionSignals(emotionSignals),
    evidence,
    inferredRisk,
    negativeHits,
    positiveHits,
    primaryEmotionKey,
    sentiment,
    stress,
    topEvidenceScore,
  };
}

// ---------------------------------------------------------------------------
// Repair passes — heuristic adjusts Groq's output
// ---------------------------------------------------------------------------

function repairEmotionSignalConsistency(validated, text, validation) {
  if (!validation) return validated;

  const evidence = validation.evidence || scoreTextEmotionEvidence(text);
  const heuristicSignals = validation.emotionSignals || {};
  const candidateKey = validation.primaryEmotionKey || getDominantEmotionKey(evidence);
  const candidateScore = Math.max(Number(evidence[candidateKey]) || 0, Number(heuristicSignals[candidateKey]) || 0);
  const heuristicConfidence = validation.confidence || 0;
  const groqConfidence = scoreSignalConfidence(validated.emotionSignals);
  const hasValidationSignal = candidateKey && (candidateScore > 0 || heuristicConfidence > 0);

  if (!hasValidationSignal) {
    // Safety guard: if Groq labelled neutral but its own emotionSignals already
    // show a challenging emotion dominating, override immediately.
    if (validated.primaryEmotionKey === "neutral") {
      const dominantChallenging = Object.entries(validated.emotionSignals)
        .filter(([key]) => CHALLENGING_EMOTION_KEYS.has(key))
        .sort((a, b) => b[1] - a[1])[0];

      if (dominantChallenging && dominantChallenging[1] >= 0.18) {
        const overrideKey = dominantChallenging[0];
        const overriddenSignals = { ...validated.emotionSignals };
        overriddenSignals.neutral = Math.min(Number(overriddenSignals.neutral) || 0, 0.08);
        return {
          ...validated,
          emotion: getEmotionLabel(overrideKey),
          emotionSignals: normalizeEmotionSignals(overriddenSignals),
          primaryEmotionKey: overrideKey,
        };
      }
    }
    return validated;
  }

  const emotionSignals = { ...validated.emotionSignals };
  const currentPrimarySignal = Number(emotionSignals[validated.primaryEmotionKey]) || 0;
  const contradictoryPositive =
    POSITIVE_EMOTION_KEYS.has(validated.primaryEmotionKey) && CHALLENGING_EMOTION_KEYS.has(candidateKey);

  const shouldOverridePrimary =
    (validated.primaryEmotionKey === "neutral" && heuristicConfidence >= 42) ||
    (contradictoryPositive && heuristicConfidence >= 55) ||
    (heuristicConfidence >= 65 && groqConfidence < 58) ||
    candidateScore > currentPrimarySignal + 0.2;

  // Merge evidence and heuristic signals (weighted blend, not winner-takes-all)
  Object.entries(evidence).forEach(([emotionKey, score]) => {
    if (score > 0) {
      emotionSignals[emotionKey] = Math.max(Number(emotionSignals[emotionKey]) || 0, score);
    }
  });
  Object.entries(heuristicSignals).forEach(([emotionKey, score]) => {
    if (score > 0 && heuristicConfidence >= 50) {
      emotionSignals[emotionKey] = Math.max(Number(emotionSignals[emotionKey]) || 0, score * 0.8);
    }
  });

  if (shouldOverridePrimary) {
    emotionSignals.neutral = Math.min(Number(emotionSignals.neutral) || 0, 0.08);
  }

  let primaryEmotionKey = shouldOverridePrimary
    ? candidateKey
    : resolvePrimaryEmotionKey(validated.primaryEmotionKey, emotionSignals);

  // Final guard: after merging, if still neutral but a challenging emotion is stronger, fix it
  if (primaryEmotionKey === "neutral") {
    const dominantChallenging = Object.entries(emotionSignals)
      .filter(([key]) => CHALLENGING_EMOTION_KEYS.has(key))
      .sort((a, b) => b[1] - a[1])[0];

    if (dominantChallenging && dominantChallenging[1] > (Number(emotionSignals.neutral) || 0)) {
      primaryEmotionKey = dominantChallenging[0];
      emotionSignals.neutral = Math.min(Number(emotionSignals.neutral) || 0, 0.08);
    }
  }

  return {
    ...validated,
    emotion: getEmotionLabel(primaryEmotionKey),
    emotionSignals: normalizeEmotionSignals(emotionSignals),
    primaryEmotionKey,
  };
}

function repairSentimentConsistency(validated, text, validation) {
  // Guard against missing validation (defensive — buildHeuristicValidation should always return)
  if (!validation) return validated;

  const normalizedText = normalizeTextForMatching(text);
  const positivePhraseMatches = countPhraseMatches(normalizedText, STRONG_POSITIVE_PHRASES);
  const distressPhraseMatches = countPhraseMatches(normalizedText, DISTRESS_GUARD_PHRASES);
  const positiveSignal = maxSignalForKeys(validated.emotionSignals, POSITIVE_EMOTION_KEYS);
  const challengingSignal = maxSignalForKeys(validated.emotionSignals, CHALLENGING_EMOTION_KEYS);
  const hasPositivePrimaryEmotion = POSITIVE_EMOTION_KEYS.has(validated.primaryEmotionKey);
  const hasStrongPositiveText = positivePhraseMatches >= 2;
  const hasDistressGuard = distressPhraseMatches > 0 || challengingSignal >= 0.45;

  let sentiment = validated.sentiment;
  let stress = validated.stress;
  const heuristicConfidence = validation.confidence || 0;
  const groqConfidence = scoreSignalConfidence(validated.emotionSignals);

  if (!hasDistressGuard && (hasPositivePrimaryEmotion || hasStrongPositiveText)) {
    let sentimentFloor = 60;
    if (validated.primaryEmotionKey === "joy") sentimentFloor = 75;
    if (positiveSignal >= 0.65) sentimentFloor = Math.max(sentimentFloor, 82);
    else if (positiveSignal >= 0.4) sentimentFloor = Math.max(sentimentFloor, 72);
    if (positivePhraseMatches >= 4) sentimentFloor = Math.max(sentimentFloor, 88);
    else if (positivePhraseMatches >= 2) sentimentFloor = Math.max(sentimentFloor, 78);

    sentiment = Math.max(sentiment, sentimentFloor);
    if (hasStrongPositiveText && stress > 35) stress = 35;
  }

  if (
    CHALLENGING_EMOTION_KEYS.has(validated.primaryEmotionKey) &&
    challengingSignal >= 0.55 &&
    positivePhraseMatches === 0
  ) {
    sentiment = Math.min(sentiment, 45);
  }

  if (
    heuristicConfidence >= 62 &&
    (groqConfidence < 58 || validation.inferredRisk === "Moderate" || validation.inferredRisk === "High")
  ) {
    const sentimentGap = Math.abs((validation.sentiment ?? sentiment) - sentiment);
    const stressGap = Math.abs((validation.stress ?? stress) - stress);

    if (sentimentGap >= 28) sentiment = Math.round(sentiment * 0.72 + validation.sentiment * 0.28);
    if (stressGap >= 24) stress = Math.round(stress * 0.72 + validation.stress * 0.28);
    if (validation.inferredRisk === "Moderate" || validation.inferredRisk === "High") {
      stress = Math.max(stress, Math.min(validation.stress, 55));
    }
  }

  return {
    ...validated,
    sentiment: Math.round(clampNumber(sentiment, 0, 100, 50)),
    stress: Math.round(clampNumber(stress, 0, 100, 20)),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

function refineGroqAnalysis(validated, text) {
  const validation = buildHeuristicValidation(text);
  const emotionRepaired = repairEmotionSignalConsistency(validated, text, validation);
  return repairSentimentConsistency(emotionRepaired, text, validation);
}

module.exports = {
  buildHeuristicValidation,
  refineGroqAnalysis,
  scoreSignalConfidence,
};
