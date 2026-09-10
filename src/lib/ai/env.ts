export const geminiApiKey = process.env.GEMINI_API_KEY?.trim();
export const geminiModel =
  process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash";

export function isGeminiConfigured(): boolean {
  return Boolean(geminiApiKey);
}
