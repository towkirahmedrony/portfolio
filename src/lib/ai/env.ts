function readServerEnv(name: string): string | undefined {
  const value = process.env[name];
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** Fallback model when GEMINI_MODEL is unset. Must stay a current model. */
const DEFAULT_GEMINI_MODEL = "gemini-3.6-flash";
const DEFAULT_GEMINI_API_ORIGIN = "https://generativelanguage.googleapis.com/v1beta";

export const GEMINI_THINKING_LEVELS = ["minimal", "low", "medium", "high"] as const;
export type GeminiThinkingLevel = (typeof GEMINI_THINKING_LEVELS)[number];

/**
 * Default thinking level for this assistant. gemini-3.6-flash defaults to
 * "medium" thinking, which dominates time-to-first-token on a FAQ-style
 * assistant. "low" keeps fact retrieval fast; set GEMINI_THINKING_LEVEL to
 * override, or to "off"/"none"/"default" to let the model decide.
 */
const DEFAULT_GEMINI_THINKING_LEVEL: GeminiThinkingLevel = "low";

export function getGeminiApiKey(): string | undefined {
  return readServerEnv("GEMINI_API_KEY");
}

export function getGeminiModel(): string {
  return readServerEnv("GEMINI_MODEL") || DEFAULT_GEMINI_MODEL;
}

/** Overridable only for local testing; production uses the public API origin. */
export function getGeminiApiOrigin(): string {
  const configured = readServerEnv("GEMINI_API_ORIGIN") || DEFAULT_GEMINI_API_ORIGIN;
  return configured.replace(/\/+$/, "");
}

export function getGeminiThinkingLevel(): GeminiThinkingLevel | null {
  const configured = readServerEnv("GEMINI_THINKING_LEVEL");
  if (!configured) {
    return DEFAULT_GEMINI_THINKING_LEVEL;
  }

  const normalized = configured.toLowerCase();
  if (["off", "none", "default", "model", "false", "0"].includes(normalized)) {
    return null;
  }

  return (GEMINI_THINKING_LEVELS as readonly string[]).includes(normalized)
    ? (normalized as GeminiThinkingLevel)
    : DEFAULT_GEMINI_THINKING_LEVEL;
}

export function isGeminiConfigured(): boolean {
  return Boolean(getGeminiApiKey());
}
