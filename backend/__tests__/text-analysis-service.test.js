const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");

function loadApplyCrisisSafetyOverrides() {
  const file = path.resolve(__dirname, "../text-analysis-service.js");
  const source = `${fs.readFileSync(file, "utf8")}\nmodule.exports.__test__ = { applyCrisisSafetyOverrides };\n`;
  const mod = new Module(file, module);
  mod.filename = file;
  mod.paths = Module._nodeModulePaths(path.dirname(file));
  mod._compile(source, file);
  return mod.exports.__test__.applyCrisisSafetyOverrides;
}

const applyCrisisSafetyOverrides = loadApplyCrisisSafetyOverrides();

const neutralSignals = {
  calm: 0,
  joy: 0,
  hopeful: 0,
  focused: 0,
  neutral: 1,
  fatigue: 0,
  sadness: 0,
  anxiety: 0,
  stress: 0,
  anger: 0,
  fear: 0,
  overwhelm: 0,
};

const model = {
  id: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
  version: "1.0.0",
  mode: "groq-llm",
};

function validated(overrides = {}) {
  return {
    emotion: "Neutral",
    sentiment: 50,
    stress: 20,
    risk: "Low",
    support: "Gentle check-in",
    response: "x",
    recommendations: [],
    emotionSignals: neutralSignals,
    primaryEmotionKey: "neutral",
    ...overrides,
  };
}

function expected(overrides = {}, safety) {
  return {
    ...validated(overrides),
    safety,
    model,
  };
}

test("applyCrisisSafetyOverrides preserves current branch behavior", () => {
  const cases = [
    {
      name: "priority1 crisis phrase",
      input: validated({ sentiment: 80, stress: 10 }),
      text: "I want to die",
      expected: expected(
        { sentiment: 80, stress: 10, risk: "High", support: "Immediate calming support" },
        {
          level: "crisis",
          escalation: "immediate",
          isCrisis: true,
          matchedSignals: ["want to die"],
          guidance: "Call Tele-MANAS (14416) for immediate mental health support in India",
          actions: [
            "Call Tele-MANAS (14416) for immediate mental health support in India",
            "Contact local emergency services if you are in immediate danger",
            "Move near another person or trusted contact",
          ],
        }
      ),
    },
    {
      name: "priority2 stress high",
      input: validated({ sentiment: 60, stress: 78 }),
      text: "plain checkin",
      expected: expected(
        { sentiment: 60, stress: 78, risk: "High", support: "Immediate calming support" },
        {
          level: "elevated",
          escalation: "strong-support",
          isCrisis: false,
          matchedSignals: [],
          guidance: "Call Tele-MANAS (14416) for immediate mental health support in India",
          actions: [
            "Call Tele-MANAS (14416) for immediate mental health support in India",
            "Message a trusted person",
            "Reach out to someone you trust today",
          ],
        }
      ),
    },
    {
      name: "priority2 sentiment low",
      input: validated({ sentiment: 18, stress: 20 }),
      text: "plain checkin",
      expected: expected(
        { sentiment: 18, stress: 20, risk: "High", support: "Immediate calming support" },
        {
          level: "elevated",
          escalation: "strong-support",
          isCrisis: false,
          matchedSignals: [],
          guidance: "Call Tele-MANAS (14416) for immediate mental health support in India",
          actions: [
            "Call Tele-MANAS (14416) for immediate mental health support in India",
            "Message a trusted person",
            "Reach out to someone you trust today",
          ],
        }
      ),
    },
    {
      name: "priority2 moderate stress",
      input: validated({ sentiment: 60, stress: 45 }),
      text: "plain checkin",
      expected: expected(
        { sentiment: 60, stress: 45, risk: "Moderate", support: "Structured support" },
        {
          level: "elevated",
          escalation: "strong-support",
          isCrisis: false,
          matchedSignals: [],
          guidance: "Call Tele-MANAS (14416) for immediate mental health support in India",
          actions: [
            "Call Tele-MANAS (14416) for immediate mental health support in India",
            "Message a trusted person",
            "Consider professional support today",
          ],
        }
      ),
    },
    {
      name: "priority2 moderate sentiment",
      input: validated({ sentiment: 45, stress: 20 }),
      text: "plain checkin",
      expected: expected(
        { sentiment: 45, stress: 20, risk: "Moderate", support: "Structured support" },
        {
          level: "elevated",
          escalation: "strong-support",
          isCrisis: false,
          matchedSignals: [],
          guidance: "Call Tele-MANAS (14416) for immediate mental health support in India",
          actions: [
            "Call Tele-MANAS (14416) for immediate mental health support in India",
            "Message a trusted person",
            "Consider professional support today",
          ],
        }
      ),
    },
    {
      name: "priority3 elevated safety",
      input: validated({ sentiment: 60, stress: 20, support: "Mood maintenance" }),
      text: "I feel hopeless",
      expected: expected(
        { sentiment: 60, stress: 20, risk: "Moderate", support: "Structured support" },
        {
          level: "elevated",
          escalation: "strong-support",
          isCrisis: false,
          matchedSignals: ["hopeless"],
          guidance: "Call Tele-MANAS (14416) for immediate mental health support in India",
          actions: [
            "Call Tele-MANAS (14416) for immediate mental health support in India",
            "Message a trusted person",
            "Consider professional support today",
          ],
        }
      ),
    },
    {
      name: "priority3 watch safety with stress",
      input: validated({ sentiment: 60, stress: 62, support: "Mood maintenance" }),
      text: "plain checkin",
      expected: expected(
        { sentiment: 60, stress: 62, risk: "Moderate", support: "Mood maintenance" },
        {
          level: "watch",
          escalation: "strong-support",
          isCrisis: false,
          matchedSignals: [],
          guidance: "Call Tele-MANAS (14416) for immediate mental health support in India",
          actions: [
            "Call Tele-MANAS (14416) for immediate mental health support in India",
            "Message a trusted person",
            "Consider professional support today",
          ],
        }
      ),
    },
    {
      name: "no override",
      input: validated({ sentiment: 60, stress: 20 }),
      text: "plain checkin",
      expected: expected(
        { sentiment: 60, stress: 20 },
        {
          level: "none",
          escalation: "none",
          isCrisis: false,
          matchedSignals: [],
          guidance: "No crisis escalation signals were detected in this check-in.",
          actions: [],
        }
      ),
    },
  ];

  cases.forEach(({ name, input, text, expected: expectedResult }) => {
    assert.deepEqual(applyCrisisSafetyOverrides(input, text), expectedResult, name);
  });
});
