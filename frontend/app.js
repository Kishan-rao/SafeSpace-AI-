const emotionInput = document.getElementById("emotionInput");
const analyzeButton = document.getElementById("analyzeButton");
const demoFillButton = document.getElementById("demoFillButton");
const openAuthButton = document.getElementById("openAuthButton");
const logoutButton = document.getElementById("logoutButton");
const startCameraButton = document.getElementById("startCameraButton");
const stopCameraButton = document.getElementById("stopCameraButton");
const captureButton = document.getElementById("captureButton");
const toggleCameraButton = document.getElementById("toggleCameraButton");
const webcamVideo = document.getElementById("webcamVideo");
const cameraStatus = document.getElementById("cameraStatus");
const cameraMessage = document.getElementById("cameraMessage");
const breathingExerciseButton = document.getElementById("breathingExerciseButton");
const breathingPanel = document.getElementById("breathingPanel");
const closeBreathingButton = document.getElementById("closeBreathingButton");
const breathingText = document.getElementById("breathingText");


const dominantEmotion = document.getElementById("dominantEmotion");
const sentimentScore = document.getElementById("sentimentScore");
const stressIndex = document.getElementById("stressIndex");
const supportMode = document.getElementById("supportMode");
const recommendationGrid = document.getElementById("recommendationGrid");
const supportResponse = document.getElementById("supportResponse");
const moodBars = document.getElementById("moodBars");
const moodTrendMeta = document.getElementById("moodTrendMeta");
const userDashboardCard = document.getElementById("userDashboardCard");
const dashboardPageSummary = document.getElementById("dashboardPageSummary");
const dashboardTotalEntries = document.getElementById("dashboardTotalEntries");
const dashboardAverageSentiment = document.getElementById("dashboardAverageSentiment");
const dashboardAverageStress = document.getElementById("dashboardAverageStress");
const dashboardCommonEmotion = document.getElementById("dashboardCommonEmotion");
const dashboardEmotionFilter = document.getElementById("dashboardEmotionFilter");
const dashboardRiskFilter = document.getElementById("dashboardRiskFilter");
const dashboardHistoryList = document.getElementById("dashboardHistoryList");
const dashboardPreviousButton = document.getElementById("dashboardPreviousButton");
const dashboardNextButton = document.getElementById("dashboardNextButton");
const dashboardPaginationLabel = document.getElementById("dashboardPaginationLabel");
const expressionOutput = document.getElementById("expressionOutput");
const expressionHint = document.getElementById("expressionHint");
const expressionConfidenceList = document.getElementById("expressionConfidenceList");
const confidenceSignalStatus = document.getElementById("confidenceSignalStatus");
const expressionReliabilityScore = document.getElementById("expressionReliabilityScore");
const expressionReliabilityNote = document.getElementById("expressionReliabilityNote");
const emotionSpectrumList = document.getElementById("emotionSpectrumList");
const emotionModelStatus = document.getElementById("emotionModelStatus");
const emotionSpectrumNote = document.getElementById("emotionSpectrumNote");

const heroMoodLabel = document.getElementById("heroMoodLabel");
const heroStressScore = document.getElementById("heroStressScore");
const heroSummary = document.getElementById("heroSummary");
const metricSentiment = document.getElementById("metricSentiment");
const metricRisk = document.getElementById("metricRisk");
const authStateLabel = document.getElementById("authStateLabel");
const accountSummary = document.getElementById("accountSummary");
const authModal = document.getElementById("authModal");
const authBackdrop = document.getElementById("authBackdrop");
const closeAuthButton = document.getElementById("closeAuthButton");
const authCancelButton = document.getElementById("authCancelButton");
const loginTabButton = document.getElementById("loginTabButton");
const registerTabButton = document.getElementById("registerTabButton");
const authForm = document.getElementById("authForm");
const authNameFieldWrap = document.getElementById("authNameFieldWrap");
const authNameField = document.getElementById("authNameField");
const authEmailField = document.getElementById("authEmailField");
const authPasswordField = document.getElementById("authPasswordField");
const authSubmitButton = document.getElementById("authSubmitButton");
const authDescription = document.getElementById("authDescription");
const authErrorMessage = document.getElementById("authErrorMessage");

const chips = [...document.querySelectorAll(".chip-row .chip")];

let cameraStream = null;
let faceApiReady = false;
let latestExpressionScores = null;
const expressionApiUrl = "/api/expression/analyze";
const expressionHealthUrl = "/api/expression/health";
const textAnalysisApiUrl = "/api/text/analyze";
const authRegisterApiUrl = "/api/auth/register";
const authLoginApiUrl = "/api/auth/login";
const authMeApiUrl = "/api/auth/me";
const authLogoutApiUrl = "/api/auth/logout";
const checkinsApiUrl = "/api/checkins";
const authTokenStorageKey = "safespace-auth-token";
const serverSessionStorageKey = "safespace-server-session-id";

let sentimentHistory = [];
let currentUser = null;
let authMode = "login";
let authToken = localStorage.getItem(authTokenStorageKey) || "";
let dashboardState = {
  page: 1,
  limit: 20,
  totalPages: 1,
  emotion: "",
  risk: "",
};

const recommendationLibrary = {
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

const emotionRecommendationLibrary = {
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

const distressLexicon = {
  high: [
    "anxious",
    "panic",
    "worthless",
    "hopeless",
    "alone",
    "depressed",
    "depression",
    "overwhelmed",
    "exhausted",
    "burnout",
    "crying",
    "can't cope",
    "cannot cope",
    "stressed",
    "helpless",
    "suicidal",
    "self harm",
    "empty",
    "numb",
    "broken",
  ],
  medium: [
    "tired",
    "worried",
    "pressure",
    "upset",
    "restless",
    "nervous",
    "drained",
    "confused",
    "frustrated",
    "sad",
    "down",
    "low mood",
    "gloomy",
  ],
  positive: [
    "hopeful",
    "calm",
    "grateful",
    "better",
    "relieved",
    "focused",
    "supported",
    "okay",
    "happy",
    "joyful",
    "excited",
    "amazing",
    "fantastic",
    "delighted",
    "thrilled",
    "joyous",
    "elated",
    "euphoric",
    "peaceful",
    "confident",
    "content",
  ],
};

const emotionModelCatalog = [
  {
    key: "calm",
    label: "Calm",
    valence: "Positive",
    energy: "Low",
    keywords: ["calm", "settled", "peaceful", "grounded", "steady", "relaxed"],
  },
  {
    key: "joy",
    label: "Joy",
    valence: "Positive",
    energy: "Medium",
    keywords: [
      "happy",
      "joy",
      "joyous",
      "excited",
      "good",
      "great",
      "content",
      "glad",
      "delighted",
      "ecstatic",
      "thrilled",
      "elated",
      "euphoric",
      "amazing",
      "fantastic",
    ],
  },
  {
    key: "hopeful",
    label: "Hopeful",
    valence: "Positive",
    energy: "Medium",
    keywords: ["hopeful", "optimistic", "better", "improving", "motivated", "confident"],
  },
  {
    key: "focused",
    label: "Focused",
    valence: "Positive",
    energy: "Medium",
    keywords: ["focused", "productive", "clear", "organized", "present", "engaged"],
  },
  {
    key: "neutral",
    label: "Neutral",
    valence: "Neutral",
    energy: "Medium",
    keywords: ["okay", "fine", "normal", "neutral", "manageable"],
  },
  {
    key: "fatigue",
    label: "Fatigue",
    valence: "Challenging",
    energy: "Low",
    keywords: ["tired", "drained", "exhausted", "sleepy", "fatigue", "low energy"],
  },
  {
    key: "sadness",
    label: "Sadness",
    valence: "Challenging",
    energy: "Low",
    keywords: ["sad", "down", "low", "empty", "lonely", "hurt", "crying", "depressed", "hopeless", "numb", "worthless"],
  },
  {
    key: "anxiety",
    label: "Anxiety",
    valence: "Challenging",
    energy: "High",
    keywords: ["anxious", "worried", "nervous", "restless", "uneasy", "panic"],
  },
  {
    key: "stress",
    label: "Stress",
    valence: "Challenging",
    energy: "High",
    keywords: ["stressed", "pressure", "deadline", "tense", "strained", "burnout"],
  },
  {
    key: "anger",
    label: "Anger",
    valence: "Challenging",
    energy: "High",
    keywords: ["angry", "frustrated", "irritated", "annoyed", "furious", "upset"],
  },
  {
    key: "fear",
    label: "Fear",
    valence: "Challenging",
    energy: "High",
    keywords: ["fear", "afraid", "scared", "unsafe", "helpless", "terrified"],
  },
  {
    key: "overwhelm",
    label: "Overwhelm",
    valence: "Challenging",
    energy: "High",
    keywords: ["overwhelmed", "can't cope", "cannot cope", "too much", "stuck", "flooded"],
  },
];

const severeRiskPhrases = [
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

const emotionKeywordBoosters = {
  calm: ["at peace", "steady", "safe", "composed", "settled"],
  joy: ["joyful", "joyous", "cheerful", "delighted", "thrilled", "elated", "euphoric", "good mood"],
  hopeful: ["hope", "optimistic", "progress", "improving", "encouraged"],
  focused: ["focus", "clarity", "discipline", "productive", "on track"],
  neutral: ["okay", "fine", "alright", "manageable"],
  fatigue: ["sleep deprived", "worn out", "burned out", "no energy", "fatigued"],
  sadness: ["heartbroken", "down", "empty", "tearful", "low mood"],
  anxiety: ["anxiety", "overthinking", "uneasy", "on edge", "panic"],
  stress: ["deadlines", "pressure", "workload", "overloaded", "tense"],
  anger: ["mad", "resentful", "rage", "annoyed", "irritated"],
  fear: ["afraid", "scared", "frightened", "unsafe", "dread"],
  overwhelm: ["too much", "flooded", "out of control", "can't handle", "cannot handle"],
};

function setSentimentHistory(entries) {
  sentimentHistory = Array.isArray(entries)
    ? entries
        .filter(
          (entry) =>
            typeof entry?.sentiment === "number" &&
            typeof entry?.emotion === "string" &&
            typeof entry?.createdAt === "string"
        )
        .slice(-5)
    : [];
}

function mapCheckinsToTrendEntries(checkins) {
  return (checkins || []).map((entry) => ({
    sentiment: Number(entry.sentiment) || 0,
    emotion: entry.emotion || "Neutral",
    createdAt: entry.createdAt || new Date().toISOString(),
    preview: String(entry.text || "Quick check-in").slice(0, 70),
  }));
}

function formatEntryTime(isoString) {
  const parsed = new Date(isoString);
  if (Number.isNaN(parsed.getTime())) {
    return "Recent";
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

function sanitizeText(text) {
  return (text || "").replace(/[&<>"']/g, (char) => {
    const replacements = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return replacements[char] || char;
  });
}

async function apiRequest(url, options = {}, includeAuth = false) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (includeAuth && authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Request failed with ${response.status}`);
  }

  return payload;
}

function setAuthToken(token) {
  authToken = token || "";
  if (authToken) {
    localStorage.setItem(authTokenStorageKey, authToken);
  } else {
    localStorage.removeItem(authTokenStorageKey);
  }
}

function setAuthMode(mode) {
  authMode = mode === "register" ? "register" : "login";
  loginTabButton.classList.toggle("active", authMode === "login");
  registerTabButton.classList.toggle("active", authMode === "register");
  authNameFieldWrap.classList.toggle("hidden", authMode !== "register");
  authSubmitButton.textContent = authMode === "register" ? "Create Account" : "Sign In";
  authDescription.textContent =
    authMode === "register"
      ? "Create an account to securely save check-ins, analysis history, and your mood trend."
      : "Sign in to keep your check-ins, saved history, and trend data connected to your account.";
  authErrorMessage.classList.add("hidden");
  authErrorMessage.textContent = "";
}

function openAuthModal(mode = authMode) {
  setAuthMode(mode);
  authModal.classList.remove("hidden");
  authModal.setAttribute("aria-hidden", "false");
}

function closeAuthModal() {
  authModal.classList.add("hidden");
  authModal.setAttribute("aria-hidden", "true");
  authForm.reset();
  authErrorMessage.classList.add("hidden");
  authErrorMessage.textContent = "";
}

function applyAuthState() {
  const isSignedIn = Boolean(currentUser);
  authStateLabel.textContent = isSignedIn ? `Signed in as ${currentUser.name}` : "Guest mode";
  accountSummary.textContent = isSignedIn
    ? ""
    : "Sign in to save your check-ins, mood history, and personalized trend data securely.";
  openAuthButton.classList.toggle("hidden", isSignedIn);
  logoutButton.classList.toggle("hidden", !isSignedIn);
  userDashboardCard.classList.toggle("hidden", !isSignedIn);
  if (!isSignedIn) {
    renderDashboardEmptyState("Sign in to view saved check-ins and dashboard history.");
  }
  renderSentimentTrend();
}

async function refreshCurrentUser() {
  if (!authToken) {
    currentUser = null;
    setSentimentHistory([]);
    applyAuthState();
    return;
  }

  try {
    const response = await apiRequest(authMeApiUrl, { method: "GET" }, true);
    currentUser = response.user;
    applyAuthState();
    await loadCheckinsFromServer();
  } catch (error) {
    console.error("User session could not be restored:", error);
    currentUser = null;
    setAuthToken("");
    setSentimentHistory([]);
    applyAuthState();
  }
}

function renderSentimentTrend() {
  if (!sentimentHistory.length) {
    moodBars.innerHTML = `
      <div class="trend-placeholder">
        ${currentUser ? "No entries yet. Add a check-in to build your real sentiment trend." : "Sign in to save check-ins and build your mood trend over time."}
      </div>
    `;
    moodTrendMeta.innerHTML = "";
    return;
  }

  const width = 760;
  const height = 230;
  const padding = { top: 18, right: 16, bottom: 36, left: 40 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const maxIndex = Math.max(sentimentHistory.length - 1, 1);

  const points = sentimentHistory.map((entry, index) => {
    const x = padding.left + (index / maxIndex) * plotWidth;
    const y = padding.top + ((100 - entry.sentiment) / 100) * plotHeight;
    return { x, y, entry, index };
  });

  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");

  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(2)} ${(
    height - padding.bottom
  ).toFixed(2)} L ${points[0].x.toFixed(2)} ${(height - padding.bottom).toFixed(2)} Z`;

  const yTicks = [0, 25, 50, 75, 100];
  moodBars.innerHTML = `
    <svg class="trend-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Sentiment trend for last 5 entries">
      ${yTicks
        .map((tick) => {
          const y = padding.top + ((100 - tick) / 100) * plotHeight;
          return `
            <line class="trend-grid" x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}"></line>
            <text class="trend-y-label" x="${padding.left - 8}" y="${y + 4}" text-anchor="end">${tick}</text>
          `;
        })
        .join("")}
      <path class="trend-area" d="${areaPath}"></path>
      <path class="trend-line" d="${linePath}"></path>
      ${points
        .map(
          (point) => `
            <circle class="trend-dot" cx="${point.x}" cy="${point.y}" r="4.5"></circle>
            <text class="trend-x-label" x="${point.x}" y="${height - 12}" text-anchor="middle">E${point.index + 1}</text>
          `
        )
        .join("")}
    </svg>
  `;

  moodTrendMeta.innerHTML = sentimentHistory
    .map(
      (entry, index) => `
        <article class="trend-meta-row">
          <span class="trend-entry-label">Entry ${index + 1} - ${sanitizeText(formatEntryTime(entry.createdAt))}</span>
          <strong class="trend-emotion">${sanitizeText(entry.emotion)}</strong>
          <span class="trend-score">${Math.round(entry.sentiment)} / 100</span>
          <span class="trend-preview">${sanitizeText(entry.preview)}</span>
        </article>
      `
    )
    .join("");
}

function buildCheckinsUrl({ page = 1, limit = 20, emotion = "", risk = "" } = {}) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });

  if (emotion) {
    params.set("emotion", emotion);
  }

  if (risk) {
    params.set("risk", risk);
  }

  return `${checkinsApiUrl}?${params.toString()}`;
}

function renderDashboardEmptyState(message) {
  dashboardTotalEntries.textContent = "0";
  dashboardAverageSentiment.textContent = "0 / 100";
  dashboardAverageStress.textContent = "0 / 100";
  dashboardCommonEmotion.textContent = "None yet";
  dashboardPageSummary.textContent = "No saved entries";
  dashboardHistoryList.innerHTML = `<div class="dashboard-empty">${sanitizeText(message)}</div>`;
  dashboardPaginationLabel.textContent = "Page 1 of 1";
  dashboardPreviousButton.disabled = true;
  dashboardNextButton.disabled = true;
}

function renderUserDashboard(payload) {
  const checkins = payload.checkins || [];
  const pagination = payload.pagination || {
    page: 1,
    totalPages: 1,
    total: checkins.length,
    hasNextPage: false,
    hasPreviousPage: false,
  };
  const summary = payload.summary || {};

  dashboardState.page = pagination.page;
  dashboardState.totalPages = pagination.totalPages;

  dashboardTotalEntries.textContent = String(summary.totalEntries || 0);
  dashboardAverageSentiment.textContent = `${Math.round(summary.averageSentiment || 0)} / 100`;
  dashboardAverageStress.textContent = `${Math.round(summary.averageStress || 0)} / 100`;
  dashboardCommonEmotion.textContent = summary.mostCommonEmotion || "None yet";
  dashboardPageSummary.textContent = `${pagination.total || 0} saved entries`;
  dashboardPaginationLabel.textContent = `Page ${pagination.page} of ${pagination.totalPages}`;
  dashboardPreviousButton.disabled = !pagination.hasPreviousPage;
  dashboardNextButton.disabled = !pagination.hasNextPage;

  if (!checkins.length) {
    dashboardHistoryList.innerHTML = `
      <div class="dashboard-empty">
        No check-ins match these filters yet.
      </div>
    `;
    return;
  }

  dashboardHistoryList.innerHTML = checkins
    .map((entry) => {
      const riskClass = String(entry.risk || "Low").toLowerCase();
      return `
        <article class="dashboard-history-item">
          <div class="history-head">
            <div>
              <strong>${sanitizeText(entry.emotion || "Neutral")}</strong>
              <div class="history-meta">${sanitizeText(formatEntryTime(entry.createdAt))}</div>
            </div>
            <span class="history-risk ${sanitizeText(riskClass)}">${sanitizeText(entry.risk || "Low")} risk</span>
          </div>
          <p class="history-text">${sanitizeText(entry.text || "No written note saved.")}</p>
          <div class="history-score-row">
            <span>Sentiment ${Math.round(entry.sentiment || 0)} / 100</span>
            <span>Stress ${Math.round(entry.stress || 0)} / 100</span>
            <span>${sanitizeText(entry.support || "Gentle check-in")}</span>
            <span>Expression: ${sanitizeText(entry.expressionLabel || "Not captured yet")}</span>
          </div>
        </article>
      `;
    })
    .join("");
}

async function loadCheckinsFromServer(options = {}) {
  if (!authToken) {
    setSentimentHistory([]);
    renderSentimentTrend();
    renderDashboardEmptyState("Sign in to view saved check-ins and dashboard history.");
    return;
  }

  dashboardState = {
    ...dashboardState,
    ...options,
  };

  try {
    const response = await apiRequest(buildCheckinsUrl(dashboardState), { method: "GET" }, true);
    const trendEntries = response.trend || response.checkins || [];
    setSentimentHistory(mapCheckinsToTrendEntries(trendEntries).slice(-5));
    renderSentimentTrend();
    renderUserDashboard(response);
  } catch (error) {
    console.error("Check-in history could not be loaded:", error);
    renderDashboardEmptyState("Check-in history could not be loaded right now.");
  }
}

async function saveCheckinToServer(analysisResult, rawText, expressionLabel = "Not captured yet") {
  if (!authToken) {
    return;
  }

  const response = await apiRequest(
    checkinsApiUrl,
    {
      method: "POST",
      body: JSON.stringify({
        text: rawText,
        sentiment: analysisResult.sentiment,
        stress: analysisResult.stress,
        emotion: analysisResult.emotion,
        risk: analysisResult.risk,
        support: analysisResult.support,
        primaryEmotionKey: analysisResult.primaryEmotionKey,
        expressionLabel,
        expressionScores: latestExpressionScores,
      }),
    },
    true
  );

  setSentimentHistory(mapCheckinsToTrendEntries(response.checkins));
  await loadCheckinsFromServer({ page: 1 });
}

function getConfidenceInsight(label, score) {
  if (score >= 75) {
    return `Strong confidence for ${label}. This is a stable facial signal for the current frame.`;
  }
  if (score >= 50) {
    return `Moderate confidence for ${label}. Capturing another frame can improve reliability.`;
  }
  return `Low confidence. Try better lighting, front-facing pose, and a steady camera for clearer expression detection.`;
}

function renderExpressionConfidence(expressions = null, source = "none", confidence = null) {
  const keys = ["neutral", "happy", "sad", "angry", "fearful", "disgusted", "surprised"];
  const normalized = keys.map((key) => ({ key, value: expressions?.[key] || 0 }));
  const sorted = [...normalized].sort((a, b) => b.value - a.value);
  const dominant = sorted[0];
  const second = sorted[1] || { value: 0 };
  const topPercent = confidence?.top ?? Math.round(dominant.value * 100);
  const marginPercent = confidence?.margin ?? Math.round((dominant.value - second.value) * 100);
  const reliability =
    confidence?.reliability ??
    clamp(Math.round(topPercent * 0.72 + Math.max(marginPercent, 0) * 0.28), 0, 100);

  expressionConfidenceList.innerHTML = normalized
    .map(
      (item) => `
        <div class="confidence-row">
          <label>${titleCase(item.key)}</label>
          <div class="confidence-track">
            <div class="confidence-fill" style="width: ${Math.round(item.value * 100)}%;"></div>
          </div>
          <span class="confidence-value">${Math.round(item.value * 100)}%</span>
        </div>
      `
    )
    .join("");

  confidenceSignalStatus.textContent =
    source === "live" ? "Live model signal" : source === "demo" ? "Demo signal" : "Awaiting capture";
  expressionReliabilityScore.textContent = `${reliability} / 100`;
  expressionReliabilityNote.textContent =
    source === "none"
      ? "Start camera and capture expression to evaluate confidence across all facial emotions."
      : getConfidenceInsight(titleCase(dominant.key), reliability);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function captureFrameSnapshot() {
  const width = webcamVideo.videoWidth || 0;
  const height = webcamVideo.videoHeight || 0;

  if (!width || !height) {
    return {
      capturedAt: new Date().toISOString(),
      width,
      height,
      imageDataUrl: "",
    };
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (context) {
    context.drawImage(webcamVideo, 0, 0, width, height);
  }

  return {
    capturedAt: new Date().toISOString(),
    width,
    height,
    imageDataUrl: canvas.toDataURL("image/jpeg", 0.55),
  };
}

async function analyzeExpressionOnServer(payload) {
  const response = await fetch(expressionApiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Backend returned ${response.status}`);
  }

  return response.json();
}

function applyExpressionResult(result) {
  latestExpressionScores = result.expressionScores;
  renderExpressionConfidence(result.expressionScores, result.sourceType, result.confidence);

  const dominantLabel = `${result.dominantExpression.label} (${result.dominantExpression.confidence}%)`;
  expressionOutput.textContent = dominantLabel;
  expressionHint.textContent = `${result.insight} Model: ${result.model.id} v${result.model.version}.`;
  applyAnalysis(dominantLabel, true);
}

function titleCase(value) {
  return value
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function normalizeForAnalysis(text) {
  return (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9'\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function countTermHits(normalizedText, terms) {
  if (!normalizedText) {
    return 0;
  }

  return terms.reduce((total, term) => {
    const escaped = escapeRegExp(term.toLowerCase()).replace(/\\ /g, "\\s+");
    const regex = new RegExp(`(^|\\s)${escaped}(?=\\s|$)`, "g");
    const matches = normalizedText.match(regex);
    return total + (matches ? matches.length : 0);
  }, 0);
}

function countIntensifiedTermHits(normalizedText, terms) {
  if (!normalizedText) {
    return 0;
  }

  const intensifiers = ["very", "extremely", "really", "so", "super", "totally", "deeply", "severely"];
  return terms.reduce((total, term) => {
    const escapedTerm = escapeRegExp(term.toLowerCase()).replace(/\\ /g, "\\s+");
    const escapedIntensifiers = intensifiers.map((word) => escapeRegExp(word)).join("|");
    const regex = new RegExp(`(^|\\s)(?:${escapedIntensifiers})\\s+${escapedTerm}(?=\\s|$)`, "g");
    const matches = normalizedText.match(regex);
    return total + (matches ? matches.length : 0);
  }, 0);
}

function countNegatedTermHits(normalizedText, terms) {
  if (!normalizedText) {
    return 0;
  }

  const negators = ["not", "never", "hardly", "barely", "cannot", "can't", "don't", "didn't", "isn't", "wasn't"];
  return terms.reduce((total, term) => {
    const escapedTerm = escapeRegExp(term.toLowerCase()).replace(/\\ /g, "\\s+");
    const escapedNegators = negators.map((word) => escapeRegExp(word)).join("|");
    const regex = new RegExp(`(^|\\s)(?:${escapedNegators})\\s+${escapedTerm}(?=\\s|$)`, "g");
    const matches = normalizedText.match(regex);
    return total + (matches ? matches.length : 0);
  }, 0);
}

function countKeywordHits(normalizedText, keywords) {
  return countTermHits(normalizedText, keywords);
}

function buildTextEmotionSignals(normalizedText) {
  const signals = {};

  emotionModelCatalog.forEach((emotion) => {
    const baseHits = countTermHits(normalizedText, emotion.keywords);
    const boosterHits = countTermHits(normalizedText, emotionKeywordBoosters[emotion.key] || []);
    const score = baseHits * 1.2 + boosterHits * 1.8;
    signals[emotion.key] = Number(score.toFixed(3));
  });

  const signalSum = Object.values(signals).reduce((sum, value) => sum + value, 0);
  if (signalSum < 0.8) {
    signals.neutral = (signals.neutral || 0) + 1.2;
  }

  return signals;
}

function getDominantEmotionKey(emotionSignals) {
  return Object.entries(emotionSignals).sort((a, b) => b[1] - a[1])[0]?.[0] || "neutral";
}

function buildFacialEmotionBlend(expressionScores = {}) {
  const neutral = expressionScores.neutral || 0;
  const happy = expressionScores.happy || 0;
  const sad = expressionScores.sad || 0;
  const angry = expressionScores.angry || 0;
  const fearful = expressionScores.fearful || 0;
  const surprised = expressionScores.surprised || 0;
  const disgusted = expressionScores.disgusted || 0;

  return {
    calm: neutral * 0.55 + happy * 0.2,
    joy: happy * 0.9 + surprised * 0.2,
    hopeful: happy * 0.5 + neutral * 0.2 + surprised * 0.2,
    focused: neutral * 0.5 + happy * 0.2,
    neutral: neutral * 0.95,
    fatigue: sad * 0.45 + neutral * 0.2,
    sadness: sad * 0.95,
    anxiety: fearful * 0.75 + surprised * 0.35,
    stress: fearful * 0.45 + angry * 0.35 + neutral * 0.2,
    anger: angry * 0.95 + disgusted * 0.35,
    fear: fearful * 0.95,
    overwhelm: fearful * 0.4 + surprised * 0.3 + sad * 0.2 + angry * 0.2,
  };
}

function getIntensityLabel(probability) {
  if (probability >= 22) {
    return "High";
  }
  if (probability >= 11) {
    return "Moderate";
  }
  return "Low";
}

function buildEmotionSpectrum(normalizedText, analysisResult, expressionScores = null) {
  const facialBlend = buildFacialEmotionBlend(expressionScores || {});
  const entries = emotionModelCatalog.map((emotion) => {
    const keywordHits = countKeywordHits(normalizedText, emotion.keywords);
    const textSignal = analysisResult.emotionSignals?.[emotion.key] || 0;
    let score = 0.12 + keywordHits * 0.85 + textSignal * 2.8;

    if (emotion.valence === "Positive") {
      score += (analysisResult.sentiment / 100) * 1.5;
      score += ((100 - analysisResult.stress) / 100) * 1.1;
    } else if (emotion.valence === "Challenging") {
      score += (analysisResult.stress / 100) * 1.7;
      score += ((100 - analysisResult.sentiment) / 100) * 1.4;
    }

    if (expressionScores) {
      score += (facialBlend[emotion.key] || 0) * 1.9;
    }

    if (emotion.key === analysisResult.primaryEmotionKey) {
      score += 1.25;
    }

    return { ...emotion, rawScore: Math.max(score, 0.05), keywordHits };
  });

  const poweredEntries = entries.map((entry) => ({
    ...entry,
    weightedScore: Math.pow(entry.rawScore, 1.35),
  }));
  const total = poweredEntries.reduce((sum, entry) => sum + entry.weightedScore, 0);

  return poweredEntries.map((entry) => {
    const probability = total > 0 ? (entry.weightedScore / total) * 100 : 0;
    return {
      ...entry,
      probability: Number(probability.toFixed(1)),
      intensity: getIntensityLabel(probability),
      signal:
        entry.keywordHits > 0 && expressionScores
          ? "Text + face"
          : entry.keywordHits > 0
            ? "Text"
            : expressionScores
              ? "Face + baseline"
              : "Baseline",
    };
  });
}

function renderEmotionSpectrum(spectrum, hasFaceSignal) {
  emotionSpectrumList.innerHTML = spectrum
    .map(
      (emotion) => `
        <article class="emotion-row">
          <div class="emotion-row-head">
            <strong>${emotion.label}</strong>
            <span>${emotion.probability}%</span>
          </div>
          <div class="emotion-bar">
            <div class="emotion-bar-fill" style="width: ${emotion.probability}%;"></div>
          </div>
          <div class="emotion-row-meta">
            ${emotion.intensity} intensity | ${emotion.valence} valence | ${emotion.energy} energy | ${emotion.signal}
          </div>
        </article>
      `
    )
    .join("");

  emotionModelStatus.textContent = hasFaceSignal ? "Text + face signals" : "Text signal only";
  emotionSpectrumNote.textContent = hasFaceSignal
    ? "Probabilities blend linguistic cues with detected facial expressions."
    : "Probabilities currently use text and baseline priors. Start camera + capture for multimodal tracking.";
}

function renderEmotionSpectrumResetState(reason = "idle") {
  emotionSpectrumList.innerHTML = emotionModelCatalog
    .map(
      (emotion) => `
        <article class="emotion-row">
          <div class="emotion-row-head">
            <strong>${emotion.label}</strong>
            <span>0%</span>
          </div>
          <div class="emotion-bar">
            <div class="emotion-bar-fill" style="width: 0%;"></div>
          </div>
          <div class="emotion-row-meta">
            Low intensity | ${emotion.valence} valence | ${emotion.energy} energy | Waiting for capture
          </div>
        </article>
      `
    )
    .join("");

  emotionModelStatus.textContent = "Awaiting analysis";
  emotionSpectrumNote.textContent =
    "Shows probability and intensity for every modeled emotion in this prototype.";
}

function resetEmotionTracker(reason = "idle") {
  latestExpressionScores = null;
  renderEmotionSpectrumResetState(reason);
}

async function syncServerSessionState() {
  try {
    const response = await fetch(expressionHealthUrl, { cache: "no-store" });
    if (!response.ok) {
      return;
    }

    const payload = await response.json();
    const currentSessionId = payload.serverSessionId || "";
    const previousSessionId = sessionStorage.getItem(serverSessionStorageKey);

    if (previousSessionId && currentSessionId && previousSessionId !== currentSessionId) {
      resetEmotionTracker("server-restart");
    }

    if (currentSessionId) {
      sessionStorage.setItem(serverSessionStorageKey, currentSessionId);
    }
  } catch (error) {
    console.error("Server session state could not be checked:", error);
  }
}

function buildPersonalizedRecommendations(primaryEmotionKey, risk) {
  const riskKey = risk === "High" ? "high" : risk === "Moderate" ? "medium" : "low";
  const emotionCards = emotionRecommendationLibrary[primaryEmotionKey] || emotionRecommendationLibrary.neutral;
  const riskCards = recommendationLibrary[riskKey] || recommendationLibrary.low;

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

async function analyzeTextOnServer(text) {
  const response = await fetch(textAnalysisApiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    throw new Error(`Text analysis backend returned ${response.status}`);
  }

  return response.json();
}

function renderRecommendations(cards) {
  recommendationGrid.innerHTML = cards
    .map(
      (item) => `
        <article class="recommendation-card">
          <span class="tag">${item.tag}</span>
          <strong>${item.title}</strong>
          <p>${item.text}</p>
        </article>
      `
    )
    .join("");
}

function updateHero(result, expressionLabel) {
  heroMoodLabel.textContent = result.emotion;
  heroStressScore.textContent = `${Math.round(result.stress)}%`;
  heroSummary.textContent = `${result.response} Facial cue: ${expressionLabel}.`;
  metricSentiment.textContent =
    result.sentiment >= 60 ? "Positive" : result.sentiment >= 35 ? "Mixed" : "Negative";
  metricRisk.textContent = result.risk;
}

async function applyAnalysis(expressionLabel = "Not captured yet", shouldTrack = false) {
  const normalizedText = normalizeForAnalysis(emotionInput.value);
  supportResponse.textContent = "Analyzing your check-in with the hosted NLP service...";

  let result;
  try {
    result = await analyzeTextOnServer(emotionInput.value);
  } catch (error) {
    console.error("Text analysis failed:", error);
    supportResponse.textContent =
      "The text-analysis service is currently unavailable. Please try again after the backend is running.";
    return;
  }

  const emotionSpectrum = buildEmotionSpectrum(normalizedText, result, latestExpressionScores);

  dominantEmotion.textContent = result.emotion;
  sentimentScore.textContent = `${Math.round(result.sentiment)} / 100`;
  stressIndex.textContent = `${Math.round(result.stress)} / 100`;
  supportMode.textContent = result.support;
  supportResponse.textContent = result.response;

  if (shouldTrack) {
    try {
      await saveCheckinToServer(result, emotionInput.value, expressionLabel);
    } catch (error) {
      console.error("Check-in could not be saved:", error);
      supportResponse.textContent = `${result.response} Sign in to save this check-in to your personal history.`;
    }
    if (!authToken) {
      supportResponse.textContent = `${result.response} Sign in to save this check-in to your personal history.`;
    }
  }

  renderSentimentTrend();
  renderRecommendations(result.recommendations);
  renderEmotionSpectrum(emotionSpectrum, Boolean(latestExpressionScores));
  updateHero(result, expressionLabel);
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  authErrorMessage.classList.add("hidden");
  authErrorMessage.textContent = "";

  const payload = {
    name: authNameField.value.trim(),
    email: authEmailField.value.trim(),
    password: authPasswordField.value,
  };

  try {
    const response = await apiRequest(
      authMode === "register" ? authRegisterApiUrl : authLoginApiUrl,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );

    setAuthToken(response.token);
    currentUser = response.user;
    applyAuthState();
    await loadCheckinsFromServer();
    closeAuthModal();
  } catch (error) {
    authErrorMessage.textContent = error.message;
    authErrorMessage.classList.remove("hidden");
  }
}

async function handleLogout() {
  try {
    if (authToken) {
      await apiRequest(authLogoutApiUrl, { method: "POST" }, true);
    }
  } catch (error) {
    console.error("Logout failed:", error);
  }

  currentUser = null;
  setAuthToken("");
  setSentimentHistory([]);
  dashboardState = {
    page: 1,
    limit: 20,
    totalPages: 1,
    emotion: "",
    risk: "",
  };
  dashboardEmotionFilter.value = "";
  dashboardRiskFilter.value = "";
  applyAuthState();
}

async function loadFaceApiModels() {
  if (!window.faceapi) {
    expressionHint.textContent =
      "Face expression library not loaded. The UI still supports webcam capture and backend integration.";
    return false;
  }

  try {
    const modelBase = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/";
    await Promise.all([
      window.faceapi.nets.tinyFaceDetector.loadFromUri(modelBase),
      window.faceapi.nets.faceExpressionNet.loadFromUri(modelBase),
    ]);
    faceApiReady = true;
    expressionHint.textContent =
      "Expression model loaded. Capture a frame to estimate calm, happy, neutral, sad, or fearful cues.";
    return true;
  } catch (error) {
    console.error("Face model failed to load:", error);
    expressionHint.textContent =
      "Webcam works, but the face emotion model could not load. Hook this UI to your preferred browser model or API.";
    return false;
  }
}

async function startCamera() {
  if (cameraStream) {
    return;
  }

  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    webcamVideo.srcObject = cameraStream;
    cameraStatus.textContent = "Camera on";
    cameraMessage.textContent = "Camera is live. Capture a frame to estimate facial emotion cues.";
    await loadFaceApiModels();
  } catch (error) {
    console.error("Camera access failed:", error);
    cameraStatus.textContent = "Camera blocked";
    cameraMessage.textContent =
      "Camera permission was denied or is unavailable. The rest of the emotional support flow still works without it.";
  }
}

function stopCamera() {
  if (!cameraStream) {
    return;
  }

  cameraStream.getTracks().forEach((track) => track.stop());
  webcamVideo.srcObject = null;
  cameraStream = null;
  cameraStatus.textContent = "Camera off";
  cameraMessage.textContent = "Turn on the camera so the frontend can estimate facial emotion cues.";
  renderExpressionConfidence(null, "none");
}

async function detectExpression() {
  if (!cameraStream) {
    expressionOutput.textContent = "Start camera first";
    return;
  }

  const frame = captureFrameSnapshot();

  if (faceApiReady && window.faceapi) {
    try {
      const detection = await window.faceapi
        .detectSingleFace(webcamVideo, new window.faceapi.TinyFaceDetectorOptions())
        .withFaceExpressions();

      if (detection?.expressions) {
        try {
          const backendResult = await analyzeExpressionOnServer({
            sourceType: "live",
            expressionScores: detection.expressions,
            frame,
          });
          applyExpressionResult(backendResult);
        } catch (error) {
          console.error("Backend expression analysis failed:", error);
          latestExpressionScores = detection.expressions;
          renderExpressionConfidence(detection.expressions, "live");
          const sorted = Object.entries(detection.expressions).sort((a, b) => b[1] - a[1]);
          const [label, confidence] = sorted[0];
          const prettyLabel = `${titleCase(label)} (${Math.round(confidence * 100)}%)`;
          expressionOutput.textContent = prettyLabel;
          expressionHint.textContent =
            "Using browser-only expression results because the backend service is unavailable.";
          applyAnalysis(prettyLabel, true);
        }
        return;
      }
    } catch (error) {
      console.error("Expression detection failed:", error);
    }
  }

  const fallbackExpressions = ["Neutral", "Slightly tense", "Calm", "Low energy", "Focused"];
  const picked = fallbackExpressions[Math.floor(Math.random() * fallbackExpressions.length)];
  const fallbackExpressionMap = {
    Neutral: { neutral: 0.72, happy: 0.1, sad: 0.06, fearful: 0.04, angry: 0.04, surprised: 0.02, disgusted: 0.02 },
    "Slightly tense": {
      neutral: 0.3,
      happy: 0.04,
      sad: 0.14,
      fearful: 0.26,
      angry: 0.14,
      surprised: 0.08,
      disgusted: 0.04,
    },
    Calm: { neutral: 0.52, happy: 0.34, sad: 0.04, fearful: 0.03, angry: 0.03, surprised: 0.02, disgusted: 0.02 },
    "Low energy": {
      neutral: 0.34,
      happy: 0.05,
      sad: 0.42,
      fearful: 0.08,
      angry: 0.05,
      surprised: 0.03,
      disgusted: 0.03,
    },
    Focused: { neutral: 0.66, happy: 0.16, sad: 0.05, fearful: 0.03, angry: 0.04, surprised: 0.04, disgusted: 0.02 },
  };
  const fallbackScores = fallbackExpressionMap[picked] || null;

  try {
    const backendResult = await analyzeExpressionOnServer({
      sourceType: "demo",
      expressionScores: fallbackScores,
      frame,
    });
    applyExpressionResult(backendResult);
  } catch (error) {
    console.error("Backend expression analysis failed:", error);
    latestExpressionScores = fallbackScores;
    renderExpressionConfidence(latestExpressionScores, "demo");
    expressionOutput.textContent = `${picked} (demo estimate)`;
    expressionHint.textContent =
      "Showing a demo estimate because no live face expression result was returned and the backend service is unavailable.";
    applyAnalysis(`${picked} (demo estimate)`, true);
  }
}

demoFillButton.addEventListener("click", () => {
  emotionInput.value =
    "I have been feeling overwhelmed with classes and deadlines. I am tired, anxious, and finding it hard to switch off my thoughts at night.";
  applyAnalysis(expressionOutput.textContent, true);
});

analyzeButton.addEventListener("click", () => {
  applyAnalysis(expressionOutput.textContent, true);
});

openAuthButton.addEventListener("click", () => {
  openAuthModal("login");
});
logoutButton.addEventListener("click", handleLogout);
closeAuthButton.addEventListener("click", closeAuthModal);
authCancelButton.addEventListener("click", closeAuthModal);
authBackdrop.addEventListener("click", closeAuthModal);
loginTabButton.addEventListener("click", () => setAuthMode("login"));
registerTabButton.addEventListener("click", () => setAuthMode("register"));
authForm.addEventListener("submit", handleAuthSubmit);
dashboardEmotionFilter.addEventListener("change", () => {
  loadCheckinsFromServer({ page: 1, emotion: dashboardEmotionFilter.value });
});
dashboardRiskFilter.addEventListener("change", () => {
  loadCheckinsFromServer({ page: 1, risk: dashboardRiskFilter.value });
});
dashboardPreviousButton.addEventListener("click", () => {
  loadCheckinsFromServer({ page: Math.max(dashboardState.page - 1, 1) });
});
dashboardNextButton.addEventListener("click", () => {
  loadCheckinsFromServer({ page: Math.min(dashboardState.page + 1, dashboardState.totalPages) });
});
startCameraButton.addEventListener("click", startCamera);
toggleCameraButton.addEventListener("click", startCamera);
stopCameraButton.addEventListener("click", stopCamera);
captureButton.addEventListener("click", detectExpression);
breathingExerciseButton.addEventListener("click", startBreathingExercise);
closeBreathingButton.addEventListener("click", closeBreathingExercise);

chips.forEach((chip) => {
  chip.addEventListener("click", () => {
    emotionInput.value = chip.dataset.text || "";
    applyAnalysis(expressionOutput.textContent, true);
  });
});
let breathingInterval = null;

function startBreathingExercise() {
  breathingPanel.classList.remove("hidden");
  let inhale = true;
  breathingText.textContent = "Breathe In";

  breathingInterval = setInterval(() => {
    inhale = !inhale;
    breathingText.textContent = inhale ? "Breathe In" : "Breathe Out";
  }, 4000);
}

function closeBreathingExercise() {
  breathingPanel.classList.add("hidden");
  clearInterval(breathingInterval);
}

renderSentimentTrend();
renderRecommendations(recommendationLibrary.low);
renderExpressionConfidence(null, "none");
resetEmotionTracker();
applyAuthState();
setAuthMode("login");
syncServerSessionState();
refreshCurrentUser();
window.setInterval(syncServerSessionState, 30000);
window.addEventListener("pagehide", () => {
  sessionStorage.removeItem(serverSessionStorageKey);
  resetEmotionTracker("tab-close");
});
