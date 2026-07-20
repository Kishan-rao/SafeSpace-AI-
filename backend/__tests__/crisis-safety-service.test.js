const assert = require("node:assert/strict");
const test = require("node:test");

const {
  analyzeCrisisSafety,
  enrichSafetyForRisk,
  TELE_MANAS_GUIDANCE,
} = require("../crisis-safety-service");

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
  "give up",
  "unsafe",
];

function safetyForLevel(level) {
  return {
    level,
    escalation:
      level === "crisis"
        ? "immediate"
        : level === "elevated"
          ? "strong-support"
          : level === "watch"
            ? "gentle-check"
            : "none",
    isCrisis: level === "crisis",
    matchedSignals: [],
    guidance: "baseline",
    actions: [],
  };
}

test("each crisis phrase individually produces crisis escalation", () => {
  CRISIS_PHRASES.forEach((phrase) => {
    const result = analyzeCrisisSafety(phrase);

    assert.equal(result.level, "crisis", phrase);
    assert.equal(result.escalation, "immediate", phrase);
    assert.equal(result.isCrisis, true, phrase);
    assert.deepEqual(result.matchedSignals, [phrase], phrase);
  });
});

test("each severe distress phrase individually produces elevated level", () => {
  SEVERE_DISTRESS_PHRASES.forEach((phrase) => {
    const result = analyzeCrisisSafety(phrase);

    assert.equal(result.level, "elevated", phrase);
    assert.equal(result.escalation, "strong-support", phrase);
    assert.equal(result.isCrisis, false, phrase);
    assert.deepEqual(result.matchedSignals, [phrase], phrase);
  });
});

test("numeric safety thresholds preserve current levels", () => {
  assert.equal(analyzeCrisisSafety("plain check-in", { stress: 82, sentiment: 50 }).level, "elevated");
  assert.equal(analyzeCrisisSafety("plain check-in", { stress: 10, sentiment: 16 }).level, "elevated");
  assert.equal(analyzeCrisisSafety("plain check-in", { stress: 62, sentiment: 50 }).level, "watch");
  assert.equal(analyzeCrisisSafety("plain check-in", { stress: 10, sentiment: 32 }).level, "watch");
  assert.equal(analyzeCrisisSafety("plain check-in", { stress: 10, sentiment: 50 }).level, "none");
});

test("enrichSafetyForRisk snapshots Moderate and High risk for each starting level", () => {
  const teleManasAction = TELE_MANAS_GUIDANCE;
  const cases = [
    ["none", "Moderate", {
      level: "elevated",
      escalation: "strong-support",
      isCrisis: false,
      matchedSignals: [],
      guidance: TELE_MANAS_GUIDANCE,
      actions: [teleManasAction, "Message a trusted person", "Consider professional support today"],
    }],
    ["none", "High", {
      level: "elevated",
      escalation: "strong-support",
      isCrisis: false,
      matchedSignals: [],
      guidance: TELE_MANAS_GUIDANCE,
      actions: [teleManasAction, "Message a trusted person", "Reach out to someone you trust today"],
    }],
    ["watch", "Moderate", {
      level: "watch",
      escalation: "strong-support",
      isCrisis: false,
      matchedSignals: [],
      guidance: TELE_MANAS_GUIDANCE,
      actions: [teleManasAction, "Message a trusted person", "Consider professional support today"],
    }],
    ["watch", "High", {
      level: "elevated",
      escalation: "strong-support",
      isCrisis: false,
      matchedSignals: [],
      guidance: TELE_MANAS_GUIDANCE,
      actions: [teleManasAction, "Message a trusted person", "Reach out to someone you trust today"],
    }],
    ["elevated", "Moderate", {
      level: "elevated",
      escalation: "strong-support",
      isCrisis: false,
      matchedSignals: [],
      guidance: TELE_MANAS_GUIDANCE,
      actions: [teleManasAction, "Message a trusted person", "Consider professional support today"],
    }],
    ["elevated", "High", {
      level: "elevated",
      escalation: "strong-support",
      isCrisis: false,
      matchedSignals: [],
      guidance: TELE_MANAS_GUIDANCE,
      actions: [teleManasAction, "Message a trusted person", "Reach out to someone you trust today"],
    }],
    ["crisis", "Moderate", {
      level: "crisis",
      escalation: "immediate",
      isCrisis: true,
      matchedSignals: [],
      guidance: TELE_MANAS_GUIDANCE,
      actions: [teleManasAction, "Message a trusted person", "Consider professional support today"],
    }],
    ["crisis", "High", {
      level: "crisis",
      escalation: "immediate",
      isCrisis: true,
      matchedSignals: [],
      guidance: TELE_MANAS_GUIDANCE,
      actions: [
        teleManasAction,
        "Contact local emergency services if you are in immediate danger",
        "Move near another person or trusted contact",
      ],
    }],
  ];

  cases.forEach(([level, risk, expected]) => {
    assert.deepEqual(enrichSafetyForRisk(safetyForLevel(level), risk), expected, `${level}/${risk}`);
  });
});
