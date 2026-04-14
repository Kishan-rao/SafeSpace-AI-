const MODEL_INFO = {
  id: "safespace-nlp-service",
  version: "1.0.0",
  mode: "hosted-nlp-microservice",
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

const EMOTION_PROTOTYPES = {
  calm: "steady grounded settled peaceful breathing relaxed safe centered composed slow",
  joy: "happy joyful delighted excited grateful smiling optimistic bright wonderful amazing uplifted",
  hopeful: "hopeful encouraged improving progress healing resilient optimistic tomorrow can manage",
  focused: "focused clear productive organized prepared engaged discipline momentum on track",
  neutral: "okay fine normal manageable stable average ordinary balanced",
  fatigue: "tired exhausted drained sleepy worn out burnout low energy depleted foggy",
  sadness: "sad lonely empty hopeless tearful hurt down numb grieving depressed",
  anxiety: "anxious nervous restless racing thoughts panic overthinking uneasy on edge worried",
  stress: "stressed pressure deadlines overloaded tense strained workload demand crunch",
  anger: "angry frustrated irritated annoyed resentful furious upset unfair conflict",
  fear: "afraid scared fearful unsafe dread terrified vulnerable threatened uncertain",
  overwhelm: "overwhelmed flooded too much cannot cope cant cope drowning spiraling overloaded stuck",
};

const TOKEN_WEIGHTS = {
  amazing: 2.4,
  anxious: -2.3,
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
  fine: 0.2,
  focused: 1.7,
  grateful: 2.0,
  grounded: 1.8,
  happy: 2.2,
  hopeless: -3.1,
  hurt: -1.9,
  joy: 2.5,
  lonely: -2.3,
  low: -0.9,
  manageable: 0.8,
  nervous: -1.9,
  okay: 0.4,
  overwhelmed: -2.8,
  panic: -3.0,
  peaceful: 2.0,
  pressure: -1.9,
  productive: 1.3,
  progress: 1.2,
  racing: -1.1,
  relaxed: 1.8,
  restless: -1.7,
  sad: -2.3,
  safe: 1.4,
  scared: -2.4,
  steady: 1.5,
  stressed: -2.5,
  support: 0.9,
  tired: -1.8,
  unsafe: -3.1,
  worried: -2.0,
  worthless: -3.2,
};

const PHRASE_WEIGHTS = {
  "at peace": 2.2,
  "burned out": -2.6,
  "cannot cope": -3.2,
  "can't cope": -3.2,
  "feel okay": 0.9,
  "hard to switch off": -1.8,
  "low mood": -2.2,
  "mental overload": -2.4,
  "not sleeping": -1.8,
  "on edge": -2.0,
  "panic attack": -3.3,
  "racing thoughts": -2.5,
  "screen off": 0.8,
  "self harm": -4.4,
  "want to die": -5.0,
};

const NEGATORS = new Set(["no", "not", "never", "hardly", "barely", "cannot", "cant", "don't", "dont", "isn't", "isnt"]);
const INTENSIFIERS = new Set(["very", "really", "extremely", "deeply", "totally", "so", "super", "severely"]);

const SEVERE_RISK_PHRASES = [
  "hopeless",
  "worthless",
  "can't cope",
  "cannot cope",
  "unsafe",
  "give up",
  "suicidal",
  "self harm",
  "want to die",
  "don't want to live",
  "end it all",
  "end my life",
];

const RECOMMENDATION_LIBRARY = {
  high: [
    {
      tag: "Breathing",
      title: "4-6 calming breath cycle",
      text: "Inhale for 4 seconds, exhale for 6 seconds, and repeat for 3 minutes to lower physical tension.",
    },
    {
      tag: "Music",
      title: "Lo-fi or soft piano focus mix",
      text: "Choose slow instrumental music with low intensity to reduce overstimulation during anxious moments.",
    },
    {
      tag: "Reading",
      title: "Gentle reflective book",
      text: "Try a comforting, low-pressure read such as short essays or reflective fiction that does not demand heavy focus.",
    },
    {
      tag: "Reset",
      title: "Screen-off recovery routine",
      text: "Step away for 10 minutes, hydrate, stretch your shoulders, and look away from your devices before returning to work.",
    },
  ],
  medium: [
    {
      tag: "Routine",
      title: "Structured micro-break plan",
      text: "Use a 25-minute focus block followed by a 5-minute reset with breathing or a short walk.",
    },
    {
      tag: "Audio",
      title: "Nature or ambient playlist",
      text: "Rain sounds, ocean ambience, or acoustic playlists can make concentration feel less strained.",
    },
    {
      tag: "Movies",
      title: "Lighthearted comfort watch",
      text: "Pick a familiar feel-good movie or series episode that feels emotionally safe and relaxing.",
    },
    {
      tag: "Mindset",
      title: "Thought download journal",
      text: "Write down worries in short bullet points, then circle only the ones that need action today.",
    },
  ],
  low: [
    {
      tag: "Balance",
      title: "Mood maintenance walk",
      text: "A short outdoor walk with no notifications can help preserve calm and prevent stress build-up.",
    },
    {
      tag: "Focus",
      title: "Positive playlist rotation",
      text: "Keep a small personal playlist of grounding songs ready for transitions between work and rest.",
    },
    {
      tag: "Reading",
      title: "Inspirational short read",
      text: "Choose uplifting articles or a few pages of a meaningful book to maintain emotional steadiness.",
    },
    {
      tag: "Care",
      title: "Daily gratitude prompt",
      text: "Write one thing that felt difficult and one thing that still went well today to keep perspective balanced.",
    },
  ],
};

const EMOTION_RECOMMENDATION_LIBRARY = {
  anxiety: [
    { tag: "Anxiety", title: "5-4-3-2-1 grounding", text: "Name 5 things you see, 4 you feel, 3 you hear, 2 you smell, and 1 you taste to interrupt anxious spirals." },
    { tag: "Anxiety", title: "Worry container note", text: "Write each worry once, then choose one action now and postpone the rest for later review." },
  ],
  stress: [
    { tag: "Stress", title: "Single-task sprint", text: "Pick one smallest next step and do only that for 12 minutes with all notifications silenced." },
    { tag: "Stress", title: "Body tension reset", text: "Unclench jaw, drop shoulders, and do 30 seconds of slow neck and wrist stretches." },
  ],
  overwhelm: [
    { tag: "Overwhelm", title: "Three-item triage", text: "List everything, then keep only 3 essentials for today and defer the rest guilt-free." },
    { tag: "Overwhelm", title: "Cognitive unload", text: "Speak your thoughts into a quick voice note to release mental load before planning." },
  ],
  sadness: [
    { tag: "Mood", title: "Compassion check-in", text: "Write one kind sentence to yourself exactly like you would support a close friend." },
    { tag: "Mood", title: "Low-energy activation", text: "Do one tiny action: shower, sunlight by window, or a 5-minute walk with no pressure." },
  ],
  fatigue: [
    { tag: "Energy", title: "20-minute recharge", text: "Take a short rest break, hydrate, and avoid screens for a focused nervous-system reset." },
    { tag: "Energy", title: "Energy budgeting", text: "Move one non-urgent task to tomorrow and protect your remaining energy for essentials." },
  ],
  anger: [
    { tag: "Anger", title: "Pause before response", text: "Delay sending messages for 10 minutes, then re-read with a calmer tone and clear ask." },
    { tag: "Anger", title: "Heat discharge walk", text: "Walk briskly for a few minutes to reduce physiological arousal before problem-solving." },
  ],
  fear: [
    { tag: "Fear", title: "Safety anchoring", text: "Name what is safe right now in your environment and what support is currently available." },
    { tag: "Fear", title: "Fact vs story list", text: "Split concerns into facts and assumptions, then act only on confirmed facts first." },
  ],
  joy: [
    { tag: "Joy", title: "Savoring pause", text: "Take 60 seconds to name what is going well so your brain stores this positive state longer." },
    { tag: "Joy", title: "Share the uplift", text: "Send one appreciation message to someone; prosocial moments help sustain positive mood." },
  ],
  hopeful: [
    { tag: "Hope", title: "Momentum plan", text: "Capture one realistic next step for today to keep progress aligned with your hopeful state." },
    { tag: "Hope", title: "Strength reflection", text: "Write one challenge you handled recently and what strength helped you through it." },
  ],
  calm: [
    { tag: "Calm", title: "Protect the baseline", text: "Keep this calm by maintaining one boundary today: breaks, notifications, or workload limits." },
    { tag: "Calm", title: "Quiet focus block", text: "Use a distraction-free 30-minute block to make progress while your mind is settled." },
  ],
  focused: [
    { tag: "Focus", title: "Deep-work block", text: "Run one 45-minute focused session on your highest-impact task, then recover for 10 minutes." },
    { tag: "Focus", title: "Completion cue", text: "Define a clear done-state before you begin so effort turns into visible completion." },
  ],
  neutral: [
    { tag: "Neutral", title: "State check", text: "Pause for one minute and ask whether your body feels tense, tired, or steady right now." },
    { tag: "Neutral", title: "Preventive reset", text: "Take a brief movement and hydration break to prevent gradual stress build-up later." },
  ],
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function normalizeText(text) {
  return (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9'\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text) {
  return normalizeText(text).split(" ").filter(Boolean);
}

function simpleStem(token) {
  return token
    .replace(/'s$/g, "")
    .replace(/ing$/g, "")
    .replace(/ed$/g, "")
    .replace(/ly$/g, "")
    .replace(/ies$/g, "y")
    .replace(/s$/g, "");
}

function buildVector(text) {
  const vector = {};
  tokenize(text).forEach((token) => {
    const stemmed = simpleStem(token);
    vector[stemmed] = (vector[stemmed] || 0) + 1;
  });
  return vector;
}

function dotProduct(left, right) {
  let total = 0;
  Object.keys(left).forEach((key) => {
    total += (left[key] || 0) * (right[key] || 0);
  });
  return total;
}

function magnitude(vector) {
  return Math.sqrt(Object.values(vector).reduce((sum, value) => sum + value * value, 0));
}

function cosineSimilarity(left, right) {
  const denominator = magnitude(left) * magnitude(right);
  if (!denominator) {
    return 0;
  }
  return dotProduct(left, right) / denominator;
}

function countPhraseHits(text, phrases) {
  return phrases.reduce((total, phrase) => total + (text.includes(phrase) ? 1 : 0), 0);
}

function buildEmotionSignals(normalizedText, tokens) {
  const docVector = buildVector(normalizedText);
  const signals = {};

  EMOTION_MODEL_CATALOG.forEach((emotion) => {
    const prototypeVector = buildVector(EMOTION_PROTOTYPES[emotion.key]);
    const similarity = cosineSimilarity(docVector, prototypeVector);
    const directHits = tokens.filter((token) => EMOTION_PROTOTYPES[emotion.key].includes(token)).length;
    signals[emotion.key] = Number((similarity * 5.2 + directHits * 0.22).toFixed(4));
  });

  if (Object.values(signals).every((value) => value === 0)) {
    signals.neutral = 1;
  }

  return signals;
}

function buildRecommendations(primaryEmotionKey, risk) {
  const riskKey = risk === "High" ? "high" : risk === "Moderate" ? "medium" : "low";
  const emotionCards = EMOTION_RECOMMENDATION_LIBRARY[primaryEmotionKey] || EMOTION_RECOMMENDATION_LIBRARY.neutral;
  const riskCards = RECOMMENDATION_LIBRARY[riskKey] || RECOMMENDATION_LIBRARY.low;
  const merged = [...emotionCards, ...riskCards];
  const unique = [];
  const seenTitles = new Set();

  merged.forEach((card) => {
    if (!seenTitles.has(card.title) && unique.length < 4) {
      seenTitles.add(card.title);
      unique.push(card);
    }
  });

  return unique;
}

function buildSupportResponse(risk, sentiment, stress) {
  if (risk === "High") {
    return "Your words suggest elevated distress. The assistant should lead with grounding, reduce cognitive load, and clearly encourage immediate human support if you may be unsafe.";
  }
  if (risk === "Moderate") {
    return "Your check-in suggests meaningful strain. The assistant should keep the next steps simple, supportive, and practical rather than overwhelming.";
  }
  if (sentiment >= 68 && stress <= 34) {
    return "You sound relatively steady right now. The best support is to reinforce routines that protect this calmer baseline.";
  }
  return "Your check-in sounds mixed but manageable. A small reset or gentle reflection could help keep things from building up.";
}

function analyzeText(text) {
  const normalizedText = normalizeText(text);
  if (!normalizedText) {
    return {
      emotion: "Neutral",
      sentiment: 50,
      stress: 0,
      risk: "Low",
      support: "Gentle check-in",
      response: "A quick emotional check-in will help the assistant tailor calming suggestions.",
      recommendations: buildRecommendations("neutral", "Low"),
      emotionSignals: { neutral: 1 },
      primaryEmotionKey: "neutral",
      model: MODEL_INFO,
    };
  }

  const rawTokens = tokenize(normalizedText);
  const tokens = rawTokens.map(simpleStem);
  const emotionSignals = buildEmotionSignals(normalizedText, tokens);
  const primaryEmotionKey =
    Object.entries(emotionSignals).sort((a, b) => b[1] - a[1])[0]?.[0] || "neutral";
  const primaryEmotionLabel =
    EMOTION_MODEL_CATALOG.find((emotion) => emotion.key === primaryEmotionKey)?.label || "Neutral";

  let valenceTotal = 0;
  let stressSignal = 0;
  let positiveHits = 0;
  let negativeHits = 0;

  tokens.forEach((token, index) => {
    const weight = TOKEN_WEIGHTS[token] || 0;
    if (!weight) {
      return;
    }

    const previous = tokens[index - 1];
    const previousTwo = tokens[index - 2];
    const isNegated = NEGATORS.has(previous) || NEGATORS.has(previousTwo);
    const isIntensified = INTENSIFIERS.has(previous) || INTENSIFIERS.has(previousTwo);

    let adjusted = weight;
    if (isNegated) {
      adjusted *= -0.7;
    }
    if (isIntensified) {
      adjusted *= 1.4;
    }

    valenceTotal += adjusted;
    if (adjusted > 0) {
      positiveHits += 1;
    } else {
      negativeHits += 1;
      stressSignal += Math.abs(adjusted);
    }
  });

  Object.entries(PHRASE_WEIGHTS).forEach(([phrase, weight]) => {
    if (normalizedText.includes(phrase)) {
      valenceTotal += weight;
      if (weight < 0) {
        stressSignal += Math.abs(weight) * 0.9;
        negativeHits += 1;
      } else {
        positiveHits += 1;
      }
    }
  });

  const severeHits = countPhraseHits(normalizedText, SEVERE_RISK_PHRASES);
  const tokenVolume = clamp(tokens.length / 36, 0, 1.8);

  const sentiment = clamp(
    Math.round(50 + valenceTotal * 8.8 + (emotionSignals.joy || 0) * 3.4 + (emotionSignals.hopeful || 0) * 2.8 - (emotionSignals.sadness || 0) * 4.6 - (emotionSignals.anxiety || 0) * 4.2),
    0,
    100
  );

  const stress = clamp(
    Math.round(
      8 +
        stressSignal * 8.4 +
        (emotionSignals.stress || 0) * 7.2 +
        (emotionSignals.overwhelm || 0) * 7.8 +
        (emotionSignals.anxiety || 0) * 6.6 +
        severeHits * 14 +
        tokenVolume * 10 -
        (emotionSignals.calm || 0) * 5.6 -
        (emotionSignals.focused || 0) * 2.2
    ),
    0,
    100
  );

  let risk = "Low";
  let support = "Gentle check-in";
  if (severeHits > 0 || stress >= 78 || sentiment <= 18) {
    risk = "High";
    support = "Immediate calming support";
  } else if (stress >= 45 || sentiment <= 45 || negativeHits > positiveHits + 1) {
    risk = "Moderate";
    support = "Structured support";
  } else if (sentiment >= 68 && stress <= 34) {
    support = "Mood maintenance";
  }

  return {
    emotion: primaryEmotionLabel,
    sentiment,
    stress,
    risk,
    support,
    response: buildSupportResponse(risk, sentiment, stress),
    recommendations: buildRecommendations(primaryEmotionKey, risk),
    emotionSignals,
    primaryEmotionKey,
    model: MODEL_INFO,
  };
}

module.exports = {
  MODEL_INFO,
  analyzeText,
};
