import type {
  AiChatErrorResponse,
  AiChatHistoryResponse,
  AiChatMessage,
  AiChatSuccessResponse,
} from "@/types/ai";

export const AI_CHAT_ENDPOINT = "/api/ai/chat";
export const AI_SESSION_STORAGE_KEY = "ai-project-assistant-session";
export const AI_MESSAGE_MAX = 4_000;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isAiSessionId(value: string | null | undefined): value is string {
  return Boolean(value && UUID_PATTERN.test(value));
}

export function readStoredAiSessionId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const value = window.sessionStorage.getItem(AI_SESSION_STORAGE_KEY);
    return isAiSessionId(value) ? value : null;
  } catch {
    return null;
  }
}

export function storeAiSessionId(sessionId: string): void {
  if (typeof window === "undefined" || !isAiSessionId(sessionId)) {
    return;
  }

  try {
    window.sessionStorage.setItem(AI_SESSION_STORAGE_KEY, sessionId);
  } catch {
    // Private browsing or blocked storage should not break chat.
  }
}

export function clearStoredAiSessionId(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.removeItem(AI_SESSION_STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
}

export function createLocalAiMessage(
  role: AiChatMessage["role"],
  content: string,
): AiChatMessage {
  return {
    id: `local-${role}-${crypto.randomUUID()}`,
    role,
    content,
    createdAt: new Date().toISOString(),
    cta: null,
  };
}

function asError(payload: unknown, fallback: string): string {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof (payload as AiChatErrorResponse).error === "string" &&
    (payload as AiChatErrorResponse).error.trim().length > 0
  ) {
    return (payload as AiChatErrorResponse).error;
  }
  return fallback;
}

function fallbackForStatus(status: number, fallback: string): string {
  if (status === 429) {
    return "The assistant is busy right now. Please try again in a moment.";
  }
  if (status === 503) {
    return "The assistant is not available right now.";
  }
  if (status === 504) {
    return "The assistant took too long to reply. Please try again.";
  }
  if (status >= 500) {
    return fallback;
  }
  return fallback;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export class AiChatRequestError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(message: string, status: number, code: string | null = null) {
    super(message);
    this.name = "AiChatRequestError";
    this.status = status;
    this.code = code;
  }
}

function asCode(payload: unknown): string | null {
  if (
    payload &&
    typeof payload === "object" &&
    "code" in payload &&
    typeof (payload as AiChatErrorResponse).code === "string"
  ) {
    return (payload as AiChatErrorResponse).code ?? null;
  }
  return null;
}

export async function sendAiChatMessage(input: {
  message: string;
  sessionId: string | null;
}): Promise<AiChatSuccessResponse> {
  let response: Response;
  try {
    response = await fetch(AI_CHAT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        message: input.message,
        sessionId: input.sessionId ?? undefined,
      }),
    });
  } catch (error) {
    if (error instanceof AiChatRequestError) {
      throw error;
    }
    throw new AiChatRequestError(
      "Could not reach the assistant. Check your connection and try again.",
      0,
      "network",
    );
  }

  const payload = await readJson(response);
  if (
    response.ok &&
    payload &&
    typeof payload === "object" &&
    "ok" in payload &&
    (payload as AiChatSuccessResponse).ok === true &&
    "message" in payload
  ) {
    return payload as AiChatSuccessResponse;
  }

  throw new AiChatRequestError(
    asError(payload, fallbackForStatus(response.status, "Could not send that message. Please try again.")),
    response.status,
    asCode(payload),
  );
}

export async function loadAiChatHistory(
  sessionId: string,
): Promise<AiChatHistoryResponse> {
  const url = `${AI_CHAT_ENDPOINT}?sessionId=${encodeURIComponent(sessionId)}`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    throw new AiChatRequestError(
      "Could not reach the assistant. Check your connection and try again.",
      0,
      "network",
    );
  }

  const payload = await readJson(response);
  if (
    response.ok &&
    payload &&
    typeof payload === "object" &&
    "ok" in payload &&
    (payload as AiChatHistoryResponse).ok === true &&
    "messages" in payload
  ) {
    return payload as AiChatHistoryResponse;
  }

  throw new AiChatRequestError(
    asError(payload, fallbackForStatus(response.status, "Could not load that conversation.")),
    response.status,
    asCode(payload),
  );
}
