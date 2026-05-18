const CRISIS_PHRASES = [
  "suicidal",
  "self harm",
  "self-harm",
  "want to die",
  "don't want to live",
  "do not want to live",
  "end it all",
  "end my life",
  "kill myself",
  "hurt myself",
  "can't go on",
  "cannot go on",
  "give up",
  "unsafe",
];

const TELE_MANAS_GUIDANCE =
  "Call Tele-MANAS (14416) for immediate mental health support in India";

const TELE_MANAS_ACTION = TELE_MANAS_GUIDANCE;

const SEVERE_DISTRESS_PHRASES = [
  "hopeless",
  "worthless",
  "can't cope",
  "cannot cope",
  "helpless",
  "empty",
  "numb",
  "broken",
  "no way out",
];

function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\w\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findMatches(normalizedText, phrases) {
  return phrases.filter((phrase) => normalizedText.includes(phrase));
}

function analyzeCrisisSafety(text, context = {}) {
  const normalizedText = normalizeText(text);
  const crisisMatches = findMatches(normalizedText, CRISIS_PHRASES);
  const distressMatches = findMatches(normalizedText, SEVERE_DISTRESS_PHRASES);
  const stress = Number(context.stress) || 0;
  const sentiment = Number(context.sentiment) || 50;

  let level = "none";
  let escalation = "none";

  if (crisisMatches.length > 0) {
    level = "crisis";
    escalation = "immediate";
  } else if (distressMatches.length > 0 || stress >= 82 || sentiment <= 16) {
    level = "elevated";
    escalation = "strong-support";
  } else if (stress >= 62 || sentiment <= 32) {
    level = "watch";
    escalation = "gentle-check";
  }

  return {
    level,
    escalation,
    isCrisis: level === "crisis",
    matchedSignals: [...new Set([...crisisMatches, ...distressMatches])],
    guidance:
      level === "crisis"
        ? `${TELE_MANAS_GUIDANCE}. If you may be in immediate danger, contact local emergency services now.`
        : level === "elevated"
          ? TELE_MANAS_GUIDANCE
          : level === "watch"
            ? TELE_MANAS_GUIDANCE
            : "No crisis escalation signals were detected in this check-in.",
    actions:
      level === "crisis"
        ? [
            TELE_MANAS_ACTION,
            "Contact local emergency services if you are in immediate danger",
            "Move near another person or trusted contact",
          ]
        : level === "elevated"
          ? [TELE_MANAS_ACTION, "Message a trusted person", "Use a short grounding exercise"]
          : level === "watch"
            ? [TELE_MANAS_ACTION, "Take a brief reset", "Check in again later"]
            : [],
  };
}

function enrichSafetyForRisk(safety, risk) {
  if (risk !== "Moderate" && risk !== "High") {
    return safety;
  }

  const enriched = {
    ...safety,
    guidance: TELE_MANAS_GUIDANCE,
    actions: [TELE_MANAS_ACTION],
  };

  if (risk === "High") {
    enriched.level = safety.level === "crisis" ? "crisis" : "elevated";
    enriched.escalation = safety.level === "crisis" ? "immediate" : "strong-support";
    enriched.isCrisis = safety.level === "crisis" || safety.isCrisis;

    if (enriched.level === "crisis") {
      enriched.actions = [
        TELE_MANAS_ACTION,
        "Contact local emergency services if you are in immediate danger",
        "Move near another person or trusted contact",
      ];
    } else {
      enriched.actions = [TELE_MANAS_ACTION, "Message a trusted person", "Reach out to someone you trust today"];
    }
  } else {
    enriched.level = safety.level === "none" ? "elevated" : safety.level;
    enriched.escalation = safety.level === "crisis" ? safety.escalation : "strong-support";
    enriched.isCrisis = safety.isCrisis;
    enriched.actions = [TELE_MANAS_ACTION, "Message a trusted person", "Consider professional support today"];
  }

  return enriched;
}

module.exports = {
  analyzeCrisisSafety,
  enrichSafetyForRisk,
  TELE_MANAS_GUIDANCE,
};
