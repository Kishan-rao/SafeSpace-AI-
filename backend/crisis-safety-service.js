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
        ? "If you may be in immediate danger, contact local emergency services now. If you are in the U.S. or Canada, call or text 988 for crisis support."
        : level === "elevated"
          ? "This check-in shows elevated distress. Consider reaching out to a trusted person or professional support today."
          : level === "watch"
            ? "This check-in shows strain. Keep the next step small and check in again soon."
            : "No crisis escalation signals were detected in this check-in.",
    actions:
      level === "crisis"
        ? ["Call or text 988 if available in your region", "Contact local emergency services if you are in immediate danger", "Move near another person or trusted contact"]
        : level === "elevated"
          ? ["Message a trusted person", "Use a short grounding exercise", "Consider professional support"]
          : level === "watch"
            ? ["Take a brief reset", "Reduce your next task to one step", "Check in again later"]
            : [],
  };
}

module.exports = {
  analyzeCrisisSafety,
};
