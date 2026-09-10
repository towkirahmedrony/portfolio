export type AiChatErrorCode =
  | "config"
  | "unavailable"
  | "invalid"
  | "not_found"
  | "timeout"
  | "gemini"
  | "database"
  | "unknown";

export class AiRouteError extends Error {
  readonly status: number;
  readonly publicMessage: string;
  readonly stage: string;
  readonly code: AiChatErrorCode;
  readonly details: Record<string, unknown>;

  constructor(input: {
    message: string;
    publicMessage: string;
    status: number;
    stage: string;
    code: AiChatErrorCode;
    details?: Record<string, unknown>;
  }) {
    super(input.message);
    this.name = "AiRouteError";
    this.status = input.status;
    this.publicMessage = input.publicMessage;
    this.stage = input.stage;
    this.code = input.code;
    this.details = input.details ?? {};
  }
}

export class GeminiRequestError extends Error {
  readonly status: number;
  readonly code: "timeout" | "auth" | "not_found" | "rate_limit" | "invalid" | "empty" | "blocked" | "network" | "upstream";
  readonly finishReason: string | null;
  readonly httpStatus: number | null;

  constructor(input: {
    message: string;
    status: number;
    code: GeminiRequestError["code"];
    finishReason?: string | null;
    httpStatus?: number | null;
  }) {
    super(input.message);
    this.name = "GeminiRequestError";
    this.status = input.status;
    this.code = input.code;
    this.finishReason = input.finishReason ?? null;
    this.httpStatus = input.httpStatus ?? null;
  }
}

const SECRET_PATTERN = /AIza[0-9A-Za-z_-]{10,}|GEMINI_API_KEY|x-goog-api-key/gi;

export function sanitizeAiLogValue(value: string): string {
  return value.replace(SECRET_PATTERN, "[redacted]");
}

export function logAiEvent(
  level: "log" | "error",
  stage: string,
  details: Record<string, unknown> = {},
): void {
  const payload: Record<string, unknown> = { stage };
  for (const [key, value] of Object.entries(details)) {
    if (key === "GEMINI_API_KEY" || key.toLowerCase().includes("apikey")) {
      continue;
    }
    if (typeof value === "string") {
      payload[key] = sanitizeAiLogValue(value);
    } else {
      payload[key] = value;
    }
  }

  const line = `[ai-chat] ${stage}`;
  if (level === "error") {
    console.error(line, payload);
  } else {
    console.log(line, payload);
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return sanitizeAiLogValue(error.message);
  }
  return "unknown error";
}

export function publicMessageForGemini(error: GeminiRequestError): string {
  switch (error.code) {
    case "timeout":
      return "The assistant took too long to reply. Please try again.";
    case "rate_limit":
      return "The assistant is busy right now. Please try again in a moment.";
    case "auth":
    case "not_found":
      return "The assistant is not available right now.";
    case "blocked":
      return "That message could not be answered. Please rephrase and try again.";
    case "empty":
      return "The assistant returned an empty reply. Please try again.";
    default:
      return "The assistant could not complete that reply. Please try again.";
  }
}
