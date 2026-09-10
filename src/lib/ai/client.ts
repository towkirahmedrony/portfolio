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
    typeof (payload as AiChatErrorResponse).error === "string"
  ) {
    return (payload as AiChatErrorResponse).error;
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

export async function sendAiChatMessage(input: {
  message: string;
  sessionId: string | null;
}): Promise<AiChatSuccessResponse> {
  const response = await fetch(AI_CHAT_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({
      message: input.message,
      sessionId: input.sessionId ?? undefined,
    }),
  });

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

  throw new Error(asError(payload, "Could not send that message. Please try again."));
}

export async function loadAiChatHistory(
  sessionId: string,
): Promise<AiChatHistoryResponse> {
  const url = `${AI_CHAT_ENDPOINT}?sessionId=${encodeURIComponent(sessionId)}`;
  const response = await fetch(url, {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
  });

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

  throw new Error(asError(payload, "Could not load that conversation."));
}
