/**
 * @typedef {Object} LLMProvider
 * @property {(text: string) => Promise<string>} getCompletion
 *   Returns raw completion text (expected to be JSON per the system prompt).
 *   Must throw on failure (timeout, API error, etc.) — callers handle retry/fallback.
 */
