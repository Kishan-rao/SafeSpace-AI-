# SafeSpace.ai

SafeSpace.ai is a full-stack mental well-being prototype. It combines written emotional check-ins, optional webcam-based facial expression signals, mood tracking, saved check-in history, and calming recommendations.

The app is built with a Node.js/Express backend, MongoDB persistence through Mongoose, and a vanilla HTML/CSS/JavaScript frontend.

## Features

- Emotion check-in textarea for written mood updates
- Backend text analysis for dominant emotion, sentiment, stress, risk, support mode, safety guidance, and recommendations
- Optional webcam expression capture using browser camera access and `face-api.js`
- Expression confidence map with browser detection and backend normalization
- Account registration, login, logout, and token-based sessions
- MongoDB-backed saved check-ins per signed-in user
- Sentiment trend chart for recent check-ins
- Account dashboard summary with total entries, average mood, average stress, and most common emotion
- Standalone monthly mood calendar with day-level summaries
- Separate Mood Check-in section for filtered history cards
- Personalized calming recommendation cards
- Breathing exercise panel
- Consistent backend JSON error handling with request IDs
- Rate limiting for API, auth, and analysis endpoints

## Tech Stack

- Backend: Node.js, Express 5
- Database: MongoDB with Mongoose
- Frontend: HTML, CSS, vanilla JavaScript
- Middleware: Helmet, CORS, Morgan, custom request context, custom rate limiter
- Auth: Email/password accounts with backend-issued session tokens
- Browser model: `@vladmandic/face-api` loaded from CDN for facial expression detection

## Project Structure

- `server.js` - Express server, middleware, static frontend serving, and API routes
- `frontend/index.html` - app layout and UI structure
- `frontend/styles.css` - responsive visual design
- `frontend/app.js` - frontend state, API calls, charts, webcam flow, auth UI, and rendering
- `backend/config/db.js` - MongoDB connection and database status helpers
- `backend/models/User.js` - user account model
- `backend/models/Session.js` - login session model
- `backend/models/Checkin.js` - saved mood check-in model
- `backend/auth-service.js` - account creation, login, logout, and session lookup
- `backend/checkin-service.js` - saving, filtering, summarizing, and listing check-ins
- `backend/text-analysis-service.js` - server-side text emotion/sentiment/stress/risk analysis
- `backend/crisis-safety-service.js` - safety and crisis signal detection
- `backend/expression-service.js` - expression score normalization, confidence scoring, and audit logging
- `backend/middleware/error-handler.js` - centralized API error handling
- `backend/middleware/rate-limit.js` - in-memory rate limiter
- `backend/middleware/request-context.js` - request ID creation and response header support
- `data/expression-audit.jsonl` - created automatically when expression captures are processed

## Data Storage

Core application data is stored in MongoDB:

- Users are stored through `backend/models/User.js`
- Sessions are stored through `backend/models/Session.js`
- Saved check-ins are stored through `backend/models/Checkin.js`

The old `backend/data-store.js` JSON file helper still exists, but the main auth and check-in flow no longer uses flat JSON files. Expression captures may append audit entries to `data/expression-audit.jsonl`.

## Environment Variables

Create a `.env` file in the project root:

```env
PORT=3000
MONGODB_URI=your_mongodb_connection_string
```

Optional configuration:

```env
NODE_ENV=development
TRUST_PROXY=false
MONGODB_CONNECT_TIMEOUT_MS=5000
MONGODB_SERVER_SELECTION_TIMEOUT_MS=5000
MONGODB_MAX_POOL_SIZE=20
MONGODB_MIN_POOL_SIZE=0
API_RATE_LIMIT_WINDOW_MS=60000
API_RATE_LIMIT_MAX=180
AUTH_RATE_LIMIT_WINDOW_MS=900000
AUTH_RATE_LIMIT_MAX=20
ANALYSIS_RATE_LIMIT_WINDOW_MS=60000
ANALYSIS_RATE_LIMIT_MAX=60
```

## How To Run

Install dependencies:

```bash
npm install
```

Start the app:

```bash
npm start
```

Open:

```text
http://localhost:3000
```

MongoDB is required for account and saved check-in features. If MongoDB is unavailable, public analysis endpoints can still work, but auth and persistence endpoints return database-unavailable errors.

## Main API Endpoints

Health and diagnostics:

- `GET /api/live`
- `GET /api/ready`
- `GET /api/health`
- `GET /api/metrics`
- `GET /api/text/health`
- `GET /api/expression/health`

Analysis:

- `POST /api/text/analyze`
- `POST /api/expression/analyze`

Auth:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`

Check-ins:

- `GET /api/checkins`
- `POST /api/checkins`

## Frontend Flow

1. A user enters a written check-in.
2. The frontend sends text to `POST /api/text/analyze`.
3. The backend returns emotion, sentiment, stress, risk, support mode, recommendations, and safety guidance.
4. If signed in, the frontend saves the result to `POST /api/checkins`.
5. The dashboard renders recent trends, calendar summaries, and filtered Mood Check-in history.
6. Webcam capture can add expression context through `POST /api/expression/analyze`.

## Mood Calendar And History

The account dashboard includes a standalone monthly mood calendar. It only displays day-level mood summaries.

The saved check-in cards live in a separate top-level Mood Check-in section. The history list stays blank until an emotion or risk filter is selected, then displays matching records in a scrollable list. Each card shows:

- emotion label
- date and time
- user's message
- sentiment score
- stress score
- support type
- expression status

## Error Handling

The backend uses centralized error handling in `backend/middleware/error-handler.js`.

API errors return a consistent JSON shape:

```json
{
  "ok": false,
  "error": "Error title",
  "detail": "Human-readable detail",
  "requestId": "request-id"
}
```

Handled cases include:

- malformed JSON
- payload too large
- validation errors
- missing API routes
- database unavailable states
- rate limits
- unexpected server errors

The frontend wraps API failures in `ApiError` and displays friendlier user-facing messages for auth, text analysis, check-in loading, and save failures.

## Responsible AI Note

This prototype is for emotional support and early awareness only. It is not a medical device and does not provide diagnosis. The crisis/safety logic is a support signal layer and should be reviewed by qualified professionals before any real-world deployment.

## Good Upgrade Points

- Replace heuristic text analysis with a trained NLP model or external AI service
- Replace browser/demo facial fallback with a production-grade vision pipeline
- Add stronger password/session controls for production
- Add automated tests for services, routes, and frontend state transitions
- Add clinician-reviewed copy for high-risk safety flows
- Move expression audit logs to structured database storage if needed
