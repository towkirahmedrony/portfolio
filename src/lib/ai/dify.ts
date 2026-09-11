import { getRouteByHref, isAiRouteKey } from "@/lib/ai/cta";
import { errorMessage, logAiEvent } from "@/lib/ai/errors";
import type { AiChatMessageRow, Json } from "@/types/database";

/**
 * Server-only Dify client for POST /api/ai/chat.
 *
 * Only the chat route handler imports this module, so DIFY_API_KEY is read
 * exclusively inside the Node.js server runtime. It must never be imported
 * from a client component and the key must never be exposed with a
 * NEXT_PUBLIC_ prefix.
 *
 * Dify owns the AI orchestration (model, Nora's system instructions, the
 * chatflow) and calls back into POST /api/ai/context for live Supabase
 * business context. The website only bridges the existing chat UI to Dify,
 * so nothing in this module queries AI tables, Gemini, embeddings, or any
 * external API other than Dify.
 */

/** Kept aligned with the route's maxDuration (30s). */
const DIFY_TIMEOUT_MS = 25_000;
const UPSTREAM_MESSAGE_MAX = 200;

/** Metadata key used to persist the Dify conversation id (existing jsonb column). */
export const DIFY_CONVERSATION_METADATA_KEY = "dify_conversation_id";

function readServerEnv(name: string): string | undefined {
  const value = process.env[name];
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Base URL only, without the `/chat-messages` path, e.g.
 * https://api.dify.ai/v1 (Dify Cloud) or https://your-dify-host/v1 (self-hosted).
 */
export function getDifyApiUrl(): string | null {
  const configured = readServerEnv("DIFY_API_URL");
  if (!configured) {
    return null;
  }
  return configured.replace(/\/+$/, "");
}

/** Never returned to the client and never written to logs. */
export function getDifyApiKey(): string | undefined {
  return readServerEnv("DIFY_API_KEY");
}

export function isDifyConfigured(): boolean {
  return Boolean(getDifyApiUrl() && getDifyApiKey());
}

export type DifyRequestErrorCode =
  | "config"
  | "timeout"
  | "auth"
  | "not_found"
  | "rate_limit"
  | "invalid"
  | "empty"
  | "network"
  | "upstream";

export class DifyRequestError extends Error {
  readonly status: number;
  readonly code: DifyRequestErrorCode;
  readonly httpStatus: number | null;

  constructor(input: {
    message: string;
    status: number;
    code: DifyRequestErrorCode;
    httpStatus?: number | null;
  }) {
    super(input.message);
    this.name = "DifyRequestError";
    this.status = input.status;
    this.code = input.code;
    this.httpStatus = input.httpStatus ?? null;
  }
}

/** Safe, non-technical message for visitors. Mirrors the existing chat error UX. */
export function publicMessageForDify(error: DifyRequestError): string {
  switch (error.code) {
    case "timeout":
      return "The assistant took too long to reply. Please try again.";
    case "rate_limit":
      return "The assistant is busy right now. Please try again in a moment.";
    case "auth":
    case "not_found":
    case "config":
      return "The assistant is not available right now.";
    case "empty":
      return "The assistant returned an empty reply. Please try again.";
    default:
      return "Sorry, I'm having trouble responding right now. Please try again in a moment.";
  }
}

export type DifyStructuredReply = {
  message: string;
  actionKey: string | null;
  showCta: boolean;
  ctaReason: string | null;
};

export type DifyChatResult = DifyStructuredReply & {
  conversationId: string | null;
  durationMs: number;
};

type DifyChatResponse = {
  answer?: unknown;
  conversation_id?: unknown;
  message_id?: unknown;
  code?: unknown;
  message?: unknown;
  status?: unknown;
};

const ACTION_TAG_CAPTURE = /\[\[action:([a-z0-9-]+)\]\]/i;
const ACTION_TAG_STRIP = /\s*\[\[action:[a-z0-9-]+\]\]/gi;
/**
 * A blocking reply is complete, but a malformed trailing fragment would still
 * reach the UI, so drop an unfinished `[[action...` tail defensively.
 */
const INCOMPLETE_ACTION =
  /\s*\[\[(?:a(?:c(?:t(?:i(?:o(?:n(?::[a-z0-9-]*)?)?)?)?)?)?)?$/i;

function stripActionTags(value: string): string {
  return value.replace(ACTION_TAG_STRIP, "").replace(INCOMPLETE_ACTION, "").trim();
}

/**
 * Adapter for Dify's `answer` field. Nora normally returns plain prose; if the
 * chatflow is ever configured to answer with the previous JSON envelope or
 * `[[action:key]]` tags, those are normalized away so the existing UI never
 * has to understand Dify's (or the model's) raw format.
 */
export function parseDifyAnswer(raw: string): DifyStructuredReply {
  const text = typeof raw === "string" ? raw.trim() : "";
  if (!text) {
    return { message: "", actionKey: null, showCta: false, ctaReason: null };
  }

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? text).trim();

  if (candidate.startsWith("{")) {
    try {
      const parsed = JSON.parse(candidate) as {
        message?: unknown;
        action?: unknown;
        actionKey?: unknown;
        showCta?: unknown;
        ctaReason?: unknown;
      };
      if (typeof parsed.message === "string" && parsed.message.trim()) {
        const action =
          parsed.action && typeof parsed.action === "object" && !Array.isArray(parsed.action)
            ? (parsed.action as { key?: unknown; href?: unknown })
            : null;
        const keyCandidate =
          (typeof parsed.actionKey === "string" && parsed.actionKey) ||
          (typeof action?.key === "string" && action.key) ||
          (typeof action?.href === "string" && getRouteByHref(action.href)?.key) ||
          null;
        const actionKey =
          keyCandidate && isAiRouteKey(String(keyCandidate).toLowerCase())
            ? String(keyCandidate).toLowerCase()
            : null;
        return {
          message: stripActionTags(parsed.message),
          actionKey,
          showCta: parsed.showCta === true || actionKey === "start-project",
          ctaReason:
            typeof parsed.ctaReason === "string" && parsed.ctaReason.trim()
              ? parsed.ctaReason.trim()
              : null,
        };
      }
    } catch {
      // Not a JSON envelope: treat it as plain prose below.
    }
  }

  const match = text.match(ACTION_TAG_CAPTURE);
  const actionKey =
    match?.[1] && isAiRouteKey(match[1].toLowerCase()) ? match[1].toLowerCase() : null;

  return {
    message: stripActionTags(text),
    actionKey,
    showCta: actionKey === "start-project",
    ctaReason: null,
  };
}

function classifyHttpStatus(status: number): DifyRequestErrorCode {
  if (status === 401 || status === 403) {
    return "auth";
  }
  if (status === 404) {
    return "not_found";
  }
  if (status === 408 || status === 504) {
    return "timeout";
  }
  if (status === 429) {
    return "rate_limit";
  }
  if (status >= 400 && status < 500) {
    return "invalid";
  }
  return "upstream";
}

function statusForCode(code: DifyRequestErrorCode): number {
  if (code === "auth" || code === "not_found" || code === "config") {
    return 503;
  }
  if (code === "rate_limit") {
    return 429;
  }
  if (code === "timeout") {
    return 504;
  }
  return 502;
}

function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const name = "name" in error ? String(error.name) : "";
  return name === "TimeoutError" || name === "AbortError";
}

/** Capped upstream error hint, server-side logs only — never shown or returned. */
function upstreamSummary(bodyText: string, status: number): string {
  try {
    const parsed = JSON.parse(bodyText) as { message?: unknown; code?: unknown };
    const message = typeof parsed.message === "string" ? parsed.message : "";
    if (message.trim()) {
      return message.slice(0, UPSTREAM_MESSAGE_MAX);
    }
    if (typeof parsed.code === "string" && parsed.code.trim()) {
      return parsed.code.slice(0, UPSTREAM_MESSAGE_MAX);
    }
  } catch {
    // Not JSON; fall back to the status line.
  }
  return `HTTP ${status}`;
}

/**
 * Reads the most recent Dify conversation id from already-loaded website
 * history. The existing `ai_chat_messages.metadata` jsonb column is used, so
 * conversation continuity needs no schema change.
 */
export function readStoredConversationId(rows: AiChatMessageRow[]): string | null {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const metadata: Json | undefined = rows[index]?.metadata;
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
      continue;
    }
    const value = (metadata as { [key: string]: Json | undefined })[
      DIFY_CONVERSATION_METADATA_KEY
    ];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

/**
 * One blocking call to the Dify chatflow. `user` is a stable anonymous/session
 * identifier (the website chat session id) — no customer data, credentials, or
 * secrets are ever sent.
 */
export async function sendDifyChatMessage(input: {
  query: string;
  user: string;
  conversationId: string | null;
}): Promise<DifyChatResult> {
  const apiUrl = getDifyApiUrl();
  const apiKey = getDifyApiKey();

  if (!apiUrl || !apiKey) {
    logAiEvent("error", "dify.error", {
      code: "config",
      apiUrlPresent: Boolean(apiUrl),
      apiKeyPresent: Boolean(apiKey),
      durationMs: 0,
    });
    throw new DifyRequestError({
      message: "Dify is not configured.",
      status: 503,
      code: "config",
    });
  }

  const endpoint = `${apiUrl}/chat-messages`;
  const startedAt = Date.now();

  logAiEvent("log", "dify.request", {
    responseMode: "blocking",
    userIdentifierType: "chat-session",
    hasConversationId: Boolean(input.conversationId),
    queryChars: input.query.length,
  });

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        inputs: {},
        query: input.query,
        response_mode: "blocking",
        user: input.user,
        ...(input.conversationId ? { conversation_id: input.conversationId } : {}),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(DIFY_TIMEOUT_MS),
    });
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    if (isAbortError(error)) {
      logAiEvent("error", "dify.error", {
        code: "timeout",
        success: false,
        timedOut: true,
        durationMs,
      });
      throw new DifyRequestError({
        message: `Dify request timed out after ${DIFY_TIMEOUT_MS}ms.`,
        status: 504,
        code: "timeout",
      });
    }

    logAiEvent("error", "dify.error", {
      code: "network",
      success: false,
      durationMs,
      error: errorMessage(error),
    });
    throw new DifyRequestError({
      message: error instanceof Error ? error.message : "Dify network request failed.",
      status: 502,
      code: "network",
    });
  }

  const durationMs = Date.now() - startedAt;

  if (!response.ok) {
    const bodyText = await response.text().catch(() => "");
    const code = classifyHttpStatus(response.status);
    logAiEvent("error", "dify.error", {
      code,
      success: false,
      httpStatus: response.status,
      durationMs,
      upstream: upstreamSummary(bodyText, response.status),
    });
    throw new DifyRequestError({
      message: `Dify API error: ${upstreamSummary(bodyText, response.status)}`,
      status: statusForCode(code),
      code,
      httpStatus: response.status,
    });
  }

  let payload: DifyChatResponse;
  try {
    payload = (await response.json()) as DifyChatResponse;
  } catch {
    logAiEvent("error", "dify.error", {
      code: "upstream",
      success: false,
      httpStatus: response.status,
      durationMs,
      reason: "invalid-json",
    });
    throw new DifyRequestError({
      message: "Dify returned a non-JSON response.",
      status: 502,
      code: "upstream",
      httpStatus: response.status,
    });
  }

  const reply = parseDifyAnswer(typeof payload.answer === "string" ? payload.answer : "");
  if (!reply.message) {
    logAiEvent("error", "dify.error", {
      code: "empty",
      success: false,
      httpStatus: response.status,
      durationMs,
      upstreamCode: typeof payload.code === "string" ? payload.code : null,
    });
    throw new DifyRequestError({
      message: "Dify returned an empty reply.",
      status: 502,
      code: "empty",
      httpStatus: response.status,
    });
  }

  const conversationId =
    typeof payload.conversation_id === "string" && payload.conversation_id.trim()
      ? payload.conversation_id.trim()
      : null;

  logAiEvent("log", "dify.response", {
    success: true,
    httpStatus: response.status,
    durationMs,
    answerChars: reply.message.length,
    actionKey: reply.actionKey,
    hasConversationId: Boolean(conversationId),
  });

  return { ...reply, conversationId, durationMs };
}
