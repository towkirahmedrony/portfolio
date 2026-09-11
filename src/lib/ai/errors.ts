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

/**
 * Redacts known credential shapes from anything that reaches a log line. The
 * `app-` form covers Dify app API keys; the rest covers Gemini keys and the two
 * server-to-server secret names used by this project.
 */
const SECRET_PATTERN =
  /app-[0-9A-Za-z_-]{16,}|AIza[0-9A-Za-z_-]{10,}|GEMINI_API_KEY|DIFY_API_KEY|DIFY_CONTEXT_SECRET|x-goog-api-key|x-dify-context-secret/gi;

export function sanitizeAiLogValue(value: string): string {
  return value.replace(SECRET_PATTERN, "[redacted]");
}

export function createAiTimer() {
  const startedAt = Date.now();
  const marks: Record<string, number> = {};
  const notes: Record<string, string> = {};
  let reported = false;

  return {
    mark(name: string) {
      marks[name] = Date.now() - startedAt;
    },
    /** Records an already-measured duration (or 0 when the stage did not run). */
    set(name: string, ms: number | null, note?: string) {
      marks[name] = typeof ms === "number" && Number.isFinite(ms) ? Math.max(0, ms) : 0;
      if (note) {
        notes[name] = note;
      }
    },
    async measure<T>(name: string, task: () => Promise<T>): Promise<T> {
      const from = Date.now();
      try {
        return await task();
      } finally {
        marks[name] = Date.now() - from;
      }
    },
    elapsed(): number {
      return Date.now() - startedAt;
    },
    snapshot(): Record<string, number> {
      return { ...marks, total: Date.now() - startedAt };
    },
    /**
     * Emits the per-stage timing lines once per request. Safe to call from both
     * the streaming completion path and the outer error path.
     */
    report(): void {
      if (reported) {
        return;
      }
      reported = true;
      marks.total = Date.now() - startedAt;
      logAiTimingReport(marks, notes);
    },
  };
}

/**
 * Temporary per-stage timing instrumentation. Emits exactly one line per stage:
 *   [ai-chat] timing.<stage> = <ms>ms
 * Only durations and stage names are logged — never message content, tokens,
 * API keys, or customer data.
 */
export const AI_TIMING_ORDER = [
  "session-load",
  "history-load",
  "settings",
  "rules",
  "knowledge",
  "faqs",
  "services",
  "portfolio",
  "form-data",
  "gemini",
  "gemini-first-token",
  "dify",
  "user-message-save",
  "assistant-message-save",
  // Extra stages kept for diagnosis (not part of the required list).
  "session-create",
  "auth",
  "context",
  "total",
] as const;

export function logAiTimingReport(
  marks: Record<string, number | null | undefined>,
  notes: Record<string, string> = {},
): void {
  for (const stage of AI_TIMING_ORDER) {
    const raw = marks[stage];
    const value = typeof raw === "number" && Number.isFinite(raw) ? `${Math.round(raw)}ms` : "0ms";
    const note = notes[stage];
    console.log(`[ai-chat] timing.${stage} = ${value}${note ? ` (${note})` : ""}`);
  }
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
