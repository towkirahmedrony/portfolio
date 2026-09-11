import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { buildCta } from "@/lib/ai/cta";
import {
  DIFY_CONVERSATION_METADATA_KEY,
  DifyRequestError,
  getDifyApiKey,
  getDifyApiUrl,
  isDifyConfigured,
  publicMessageForDify,
  readStoredConversationId,
  sendDifyChatMessage,
} from "@/lib/ai/dify";
import {
  AiRouteError,
  createAiTimer,
  errorMessage,
  logAiEvent,
} from "@/lib/ai/errors";
import {
  claimSessionIfNeeded,
  createChatSession,
  insertChatMessage,
  isUuid,
  listSessionMessages,
  loadOwnedSession,
  titleFromMessage,
  toPublicMessage,
} from "@/lib/ai/sessions";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  createServiceRoleSupabaseClient,
  isServiceRoleConfigured,
} from "@/lib/supabase/service";
import type {
  AiCta,
  AiChatErrorResponse,
  AiChatMessage,
  AiChatStreamEvent,
} from "@/types/ai";
import type { AiChatMessageRow, AiChatSessionRow } from "@/types/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const VISITOR_COOKIE = "ai_visitor_id";
const VISITOR_MAX_AGE = 60 * 60 * 24 * 365;
const MESSAGE_MAX = 4_000;
/** Messages returned to the chat UI when it reloads a conversation. */
const HISTORY_DISPLAY_LIMIT = 24;
/**
 * The only reason POST reads previous messages is to recover the most recent
 * Dify conversation id, so a short window is enough. No AI table (knowledge,
 * rules, faqs, settings, services, projects) is queried there — Dify gets that
 * live context from POST /api/ai/context.
 */
const HISTORY_LOOKBACK_LIMIT = 6;

function jsonError(
  status: number,
  error: string,
  extra?: { code?: string },
) {
  const body: AiChatErrorResponse = extra?.code
    ? { ok: false, error, code: extra.code }
    : { ok: false, error };
  return NextResponse.json(body, { status });
}

function createVisitorId(): string {
  return crypto.randomUUID();
}

function readJsonString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

async function resolveVisitorId(): Promise<{
  visitorId: string;
  setCookie: boolean;
}> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(VISITOR_COOKIE)?.value?.trim();
  if (existing && existing.length <= 80) {
    return { visitorId: existing, setCookie: false };
  }
  return { visitorId: createVisitorId(), setCookie: true };
}

function withVisitorCookie(response: NextResponse, visitorId: string, setCookie: boolean) {
  if (setCookie) {
    response.cookies.set(VISITOR_COOKIE, visitorId, {
      path: "/",
      maxAge: VISITOR_MAX_AGE,
      sameSite: "lax",
      httpOnly: true,
    });
  }
  return response;
}

function fail(input: {
  status: number;
  publicMessage: string;
  stage: string;
  code: AiRouteError["code"];
  message?: string;
  details?: Record<string, unknown>;
}): never {
  throw new AiRouteError({
    status: input.status,
    publicMessage: input.publicMessage,
    stage: input.stage,
    code: input.code,
    message: input.message ?? input.publicMessage,
    details: input.details,
  });
}

function toClientError(error: unknown): {
  status: number;
  publicMessage: string;
  code: string;
} {
  if (error instanceof AiRouteError) {
    logAiEvent("error", error.stage, {
      code: error.code,
      status: error.status,
      error: error.message,
      ...error.details,
    });
    return {
      status: error.status,
      publicMessage: error.publicMessage,
      code: error.code,
    };
  }

  if (error instanceof DifyRequestError) {
    // The Dify client already logged `dify.error` with the duration, HTTP
    // status and a capped upstream hint, so this only maps to a safe message.
    return {
      status: error.status,
      publicMessage: publicMessageForDify(error),
      code: error.code === "timeout" ? "timeout" : "dify",
    };
  }

  logAiEvent("error", "unhandled", {
    error: errorMessage(error),
  });
  return {
    status: 500,
    publicMessage: "Could not complete that conversation. Please try again.",
    code: "unknown",
  };
}

export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get("sessionId");
  if (!isUuid(sessionId)) {
    return jsonError(400, "A valid sessionId is required.", { code: "invalid" });
  }

  if (!isSupabaseConfigured() || !isServiceRoleConfigured()) {
    logAiEvent("error", "history.config", {
      supabaseConfigured: isSupabaseConfigured(),
      serviceRoleConfigured: isServiceRoleConfigured(),
    });
    return jsonError(503, "The assistant is not configured yet.", { code: "config" });
  }

  let visitorId = "";
  let setCookie = false;

  try {
    const visitor = await resolveVisitorId();
    visitorId = visitor.visitorId;
    setCookie = visitor.setCookie;

    const userClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await userClient.auth.getUser();
    const service = createServiceRoleSupabaseClient();

    let session: AiChatSessionRow | null;
    try {
      session = await loadOwnedSession(service, {
        sessionId,
        userId: user?.id ?? null,
        visitorId,
      });
    } catch (error) {
      fail({
        status: 500,
        publicMessage: "Could not load that conversation.",
        stage: "history.database",
        code: "database",
        message: errorMessage(error),
        details: { sessionIdPresent: true },
      });
    }

    if (!session) {
      return withVisitorCookie(
        jsonError(404, "Conversation not found.", { code: "not_found" }),
        visitorId,
        setCookie,
      );
    }

    let rows: AiChatMessageRow[];
    try {
      rows = await listSessionMessages(
        service,
        session.id,
        HISTORY_DISPLAY_LIMIT,
      );
    } catch (error) {
      fail({
        status: 500,
        publicMessage: "Could not load that conversation.",
        stage: "history.messages",
        code: "database",
        message: errorMessage(error),
      });
    }

    const messages = rows
      .map(toPublicMessage)
      .filter((message): message is AiChatMessage => message !== null);

    logAiEvent("log", "history.success", {
      sessionId: session.id,
      messageCount: messages.length,
      authenticated: Boolean(user),
    });

    return withVisitorCookie(
      NextResponse.json({
        ok: true,
        sessionId: session.id,
        messages,
      }),
      visitorId,
      setCookie,
    );
  } catch (error) {
    const mapped = toClientError(error);
    return withVisitorCookie(
      jsonError(mapped.status, mapped.publicMessage, { code: mapped.code }),
      visitorId,
      setCookie,
    );
  }
}

/**
 * One message = one POST. Order of work:
 *   resolve visitor -> auth -> session/history -> save user message -> call the
 *   Dify chatflow (blocking) -> save assistant message -> done event.
 *
 * Dify owns the model, Nora's instructions and the live Supabase business
 * context (the chatflow's HTTP Request node calls /api/ai/context), so this
 * route never queries AI tables, never calls Gemini, and calls no external API
 * besides Dify. The response format is unchanged, so the existing chat UI needs
 * no modification.
 */
export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonError(400, "Request body must be JSON.", { code: "invalid" });
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return jsonError(400, "Request body must be a JSON object.", { code: "invalid" });
  }

  const body = payload as { message?: unknown; sessionId?: unknown; visitorId?: unknown };
  if (body.visitorId !== undefined) {
    return jsonError(400, "Anonymous identity is managed by the server.", { code: "invalid" });
  }
  const message = readJsonString(body.message);
  const requestedSessionId = readJsonString(body.sessionId);

  if (message.length === 0) {
    return jsonError(400, "Please enter a message.", { code: "invalid" });
  }
  if (message.length > MESSAGE_MAX) {
    return jsonError(400, `Message must be ${MESSAGE_MAX} characters or fewer.`, {
      code: "invalid",
    });
  }
  if (requestedSessionId && !isUuid(requestedSessionId)) {
    return jsonError(400, "A valid sessionId is required.", { code: "invalid" });
  }

  if (!isSupabaseConfigured() || !isServiceRoleConfigured()) {
    logAiEvent("error", "request.config", {
      supabaseConfigured: isSupabaseConfigured(),
      serviceRoleConfigured: isServiceRoleConfigured(),
    });
    return jsonError(503, "The assistant is not configured yet.", { code: "config" });
  }

  if (!isDifyConfigured()) {
    logAiEvent("error", "request.missing-dify-config", {
      difyApiUrlPresent: Boolean(getDifyApiUrl()),
      difyKeyPresent: Boolean(getDifyApiKey()),
    });
    return jsonError(503, "The assistant is not available right now.", { code: "config" });
  }

  let visitorId = "";
  let setCookie = false;
  const timer = createAiTimer();

  try {
    const visitor = await resolveVisitorId();
    visitorId = visitor.visitorId;
    setCookie = visitor.setCookie;

    const userClient = await createServerSupabaseClient();
    const service = createServiceRoleSupabaseClient();

    let user: { id: string } | null = null;
    try {
      const auth = await timer.measure("auth", () => userClient.auth.getUser());
      user = auth.data.user;
    } catch (error) {
      fail({
        status: 503,
        publicMessage: "The assistant is not available right now.",
        stage: "request.auth",
        code: "unavailable",
        message: errorMessage(error),
      });
    }

    const userId = user?.id ?? null;

    logAiEvent("log", "request.received", {
      hasSessionId: Boolean(requestedSessionId),
      messageChars: message.length,
      authenticated: Boolean(userId),
      difyConfigured: isDifyConfigured(),
    });

    let session: AiChatSessionRow | null = null;
    let previous: AiChatMessageRow[] = [];
    if (requestedSessionId) {
      try {
        // Both reads are independent and keyed by the same session id.
        const [loaded, rows] = await Promise.all([
          timer.measure("session-load", () =>
            loadOwnedSession(service, {
              sessionId: requestedSessionId,
              userId,
              visitorId,
            }),
          ),
          timer.measure("history-load", () =>
            listSessionMessages(service, requestedSessionId, HISTORY_LOOKBACK_LIMIT),
          ),
        ]);
        session = loaded;
        previous = rows;
      } catch (error) {
        fail({
          status: 500,
          publicMessage: "Could not load that conversation.",
          stage: "request.load-session",
          code: "database",
          message: errorMessage(error),
        });
      }

      if (!session) {
        timer.report();
        return withVisitorCookie(
          jsonError(404, "Conversation not found.", { code: "not_found" }),
          visitorId,
          setCookie,
        );
      }
    }

    if (!session) {
      try {
        session = await timer.measure("session-create", () =>
          createChatSession(service, {
            userId,
            visitorId,
            title: titleFromMessage(message),
          }),
        );
        logAiEvent("log", "request.session-created", {
          sessionId: session.id,
          authenticated: Boolean(userId),
        });
      } catch (error) {
        fail({
          status: 500,
          publicMessage: "Could not start that conversation. Please try again.",
          stage: "request.create-session",
          code: "database",
          message: errorMessage(error),
        });
      }
    } else if (userId && session.user_id !== userId) {
      session = await claimSessionIfNeeded(service, session, userId);
    }

    if (!session) {
      fail({
        status: 500,
        publicMessage: "Could not start that conversation. Please try again.",
        stage: "request.create-session",
        code: "database",
        message: "Chat session was not created.",
      });
    }

    const encoder = new TextEncoder();
    const sessionId = session.id;
    // Conversation continuity lives in the existing ai_chat_messages.metadata
    // jsonb column: no new table, column, or migration.
    const difyConversationId = readStoredConversationId(previous);

    // Kick off the user-message insert before calling Dify so it overlaps the
    // upstream request.
    const persistUser = timer.measure("user-message-save", () =>
      insertChatMessage(service, {
        sessionId,
        role: "user",
        content: message,
      }),
    );
    // Avoid an unhandled rejection if this fails before we await it below.
    void persistUser.catch(() => undefined);

    const stream = new ReadableStream({
      async start(controller) {
        const write = (event: AiChatStreamEvent) => {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        };

        // Same event sequence as before (meta -> done), so the frontend is
        // untouched. Dify runs in blocking mode and the reply arrives whole.
        write({ type: "meta", sessionId });

        try {
          const reply = await sendDifyChatMessage({
            // Stable anonymous/session identifier only: no customer data,
            // credentials, or secrets are sent to Dify.
            user: sessionId,
            query: message,
            conversationId: difyConversationId,
          });
          timer.set("dify", reply.durationMs);

          try {
            await persistUser;
          } catch (error) {
            fail({
              status: 500,
              publicMessage: "Could not save your message. Please try again.",
              stage: "request.persist-user",
              code: "database",
              message: errorMessage(error),
              details: { sessionId },
            });
          }

          const cta: AiCta | null = buildCta({
            actionKey: reply.actionKey,
            showCta: reply.showCta,
            reason: reply.ctaReason,
            userMessage: message,
          });

          const assistantRow = await timer.measure("assistant-message-save", () =>
            insertChatMessage(service, {
              sessionId,
              role: "assistant",
              content: reply.message,
              cta,
              metadata: reply.conversationId
                ? { [DIFY_CONVERSATION_METADATA_KEY]: reply.conversationId }
                : undefined,
            }),
          );

          const publicMessage = toPublicMessage(assistantRow);
          if (!publicMessage) {
            throw new Error("Could not save the assistant reply.");
          }

          logAiEvent("log", "request.success", {
            sessionId,
            authenticated: Boolean(userId),
            showCta: Boolean(cta),
            historyRows: previous.length,
            ...timer.snapshot(),
          });

          write({
            type: "done",
            sessionId,
            message: publicMessage,
            cta,
          });
        } catch (error) {
          const mapped = toClientError(error);
          write({
            type: "error",
            error: mapped.publicMessage,
            code: mapped.code,
          });
        } finally {
          controller.close();
          timer.report();
        }
      },
    });

    const response = new NextResponse(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Accel-Buffering": "no",
      },
    });
    return withVisitorCookie(response, visitorId, setCookie);
  } catch (error) {
    const mapped = toClientError(error);
    timer.report();
    return withVisitorCookie(
      jsonError(mapped.status, mapped.publicMessage, { code: mapped.code }),
      visitorId,
      setCookie,
    );
  }
}
