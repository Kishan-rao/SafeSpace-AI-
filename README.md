# CalmDown AI Frontend

This is a self-contained frontend prototype for a mental well-being support app.

## Included in the UI

- Emotion check-in textarea
- Webcam section with facial expression capture flow
- Sentiment and stress scoring dashboard
- Weekly mood tracking view
- Personalized recommendations for breathing, music, reading, movies, and reset routines
- Support response panel with responsible-AI messaging

## Files

- `frontend/index.html` - structure and content
- `frontend/styles.css` - responsive visual design
- `frontend/app.js` - frontend behavior, scoring logic, mood history, webcam flow
- `frontend/favicon.svg` and `frontend/new-logo.svg` - frontend image assets
- `server.js` - lightweight Node server that serves the frontend and backend API
- `backend/expression-service.js` - webcam emotion-processing backend service

## AI Integration Notes

- Text analysis is currently frontend heuristic logic inside `app.js`
- Webcam uses browser `getUserMedia`
- Facial expression detection is wired for `face-api` through CDN and includes a fallback demo estimate
- Mood history is stored in browser `localStorage`

## How to Run

Run `npm start` and open `http://localhost:3000` in a browser.

## Backend Expression Service

- `server.js` serves the `frontend/` folder and exposes `/api/expression/analyze`
- `backend/expression-service.js` normalizes facial expression scores, computes confidence, and writes audit logs
- `backend/text-analysis-service.js` runs the hosted NLP microservice for sentiment, emotion, stress, and risk scoring
- `backend/auth-service.js` handles account creation, login, logout, and session lookup
- `backend/checkin-service.js` stores per-user check-ins and recent mood history
- `data/expression-audit.jsonl` is created automatically when captures are processed

The current backend is a lightweight processing layer that accepts client-side face signals, adds model metadata, confidence scoring, and audit logging, and is ready to be swapped to a server-hosted vision model later.

## Text Analysis Service

- The browser no longer runs `analyzeText()` locally
- Check-ins are sent to `POST /api/text/analyze`
- The backend returns sentiment, dominant emotion, stress, risk, support mode, response copy, and recommendations
- The current implementation is a hosted NLP microservice with server-side emotion prototypes and weighted linguistic scoring

## Accounts And Persistence

- Users can create accounts and sign in from the frontend UI
- Auth uses backend-issued session tokens and hashed passwords
- Saved check-ins are written to the backend and loaded back into the mood trend view after login
- User and check-in records are stored in `data/users.json`, `data/sessions.json`, and `data/checkins.json`

## Good Backend Upgrade Points

- Replace heuristic sentiment scoring with your trained NLP model or API
- Replace demo facial fallback with a production emotion-detection model
- Save check-ins, recommendations, and risk flags in a secure backend
- Add crisis escalation rules and clinician-approved guidance
