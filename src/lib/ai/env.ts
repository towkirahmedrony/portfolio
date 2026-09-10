function readServerEnv(name: string): string | undefined {
  const value = process.env[name];
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function getGeminiApiKey(): string | undefined {
  return readServerEnv("GEMINI_API_KEY");
}

export function getGeminiModel(): string {
  return readServerEnv("GEMINI_MODEL") || "gemini-2.0-flash";
}

export function isGeminiConfigured(): boolean {
  return Boolean(getGeminiApiKey());
}
