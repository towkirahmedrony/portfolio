import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { buildAiAssistantContext, type AiAssistantContext } from "@/lib/ai/context";
import { buildCta } from "@/lib/ai/cta";
import { getGeminiModel, isGeminiConfigured } from "@/lib/ai/env";
import {
  AiRouteError,
  errorMessage,
  GeminiRequestError,
  logAiEvent,
  publicMessageForGemini,
} from "@/lib/ai/errors";
import { generateAssistantReply } from "@/lib/ai/gemini";
import {
  claimSessionIfNeeded,
  createChatSession,
  insertChatMessage,
  isUuid,
  listSessionMessages,
  loadOwnedSession,
  titleFromMessage,
  toPublicMessage,
  touchSession,
} from "@/lib/ai/sessions";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  createServiceRoleSupabaseClient,
  isServiceRoleConfigured,
} from "@/lib/supabase/service";
import type { AiCta, AiChatErrorResponse, AiChatMessage } from "@/types/ai";
import type { AiChatMessageRow, AiChatSessionRow } from "@/types/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const VISITOR_COOKIE = "ai_visitor_id";
const VISITOR_MAX_AGE = 60 * 60 * 24 * 365;
const MESSAGE_MAX = 4_000;
const HISTORY_FETCH_BUFFER = 2;

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

function historyForGemini(rows: AiChatMessageRow[]) {
  return rows
    .filter((row) => row.role === "user" || row.role === "assistant")
    .map((row) => ({
      role: row.role as "user" | "assistant",
      content: row.content,
    }));
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

  if (error instanceof GeminiRequestError) {
    logAiEvent("error", "gemini.failed", {
      code: error.code,
      status: error.status,
      httpStatus: error.httpStatus,
      finishReason: error.finishReason,
      error: error.message,
    });
    return {
      status: error.status,
      publicMessage: publicMessageForGemini(error),
      code: error.code === "timeout" ? "timeout" : "gemini",
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

    let context: AiAssistantContext;
    try {
      context = await buildAiAssistantContext();
    } catch (error) {
      fail({
        status: 503,
        publicMessage: "The assistant is not available right now.",
        stage: "history.context",
        code: "unavailable",
        message: errorMessage(error),
      });
    }

    let rows: AiChatMessageRow[];
    try {
      rows = await listSessionMessages(
        service,
        session.id,
        context.maxHistoryMessages,
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

  if (!isGeminiConfigured()) {
    logAiEvent("error", "request.missing-gemini-key", {
      geminiKeyPresent: false,
      model: getGeminiModel(),
    });
    return jsonError(503, "The assistant is not available right now.", { code: "config" });
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
    const userId = user?.id ?? null;

    let context: AiAssistantContext;
    try {
      context = await buildAiAssistantContext();
    } catch (error) {
      fail({
        status: 503,
        publicMessage: "The assistant is not available right now.",
        stage: "request.context",
        code: "unavailable",
        message: errorMessage(error),
      });
    }

    if (!context.enabled) {
      logAiEvent("log", "request.disabled", {});
      return withVisitorCookie(
        jsonError(503, "The assistant is currently disabled.", { code: "unavailable" }),
        visitorId,
        setCookie,
      );
    }

    logAiEvent("log", "request.received", {
      hasSessionId: Boolean(requestedSessionId),
      messageChars: message.length,
      authenticated: Boolean(userId),
      geminiKeyPresent: isGeminiConfigured(),
      model: getGeminiModel(),
    });

    let session: AiChatSessionRow | null = null;
    if (requestedSessionId) {
      try {
        session = await loadOwnedSession(service, {
          sessionId: requestedSessionId,
          userId,
          visitorId,
        });
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
        return withVisitorCookie(
          jsonError(404, "Conversation not found.", { code: "not_found" }),
          visitorId,
          setCookie,
        );
      }
    }

    try {
      if (!session) {
        session = await createChatSession(service, {
          userId,
          visitorId,
          title: titleFromMessage(message),
        });
        logAiEvent("log", "request.session-created", {
          sessionId: session.id,
          authenticated: Boolean(userId),
        });
      } else {
        session = await claimSessionIfNeeded(service, session, userId);
      }
    } catch (error) {
      fail({
        status: 500,
        publicMessage: "Could not start that conversation. Please try again.",
        stage: "request.create-session",
        code: "database",
        message: errorMessage(error),
      });
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

    let previous: AiChatMessageRow[] = [];
    try {
      previous = await listSessionMessages(
        service,
        session.id,
        context.maxHistoryMessages + HISTORY_FETCH_BUFFER,
      );
    } catch (error) {
      fail({
        status: 500,
        publicMessage: "Could not load that conversation.",
        stage: "request.history",
        code: "database",
        message: errorMessage(error),
        details: { sessionId: session.id },
      });
    }

    try {
      await insertChatMessage(service, {
        sessionId: session.id,
        role: "user",
        content: message,
      });
    } catch (error) {
      fail({
        status: 500,
        publicMessage: "Could not save your message. Please try again.",
        stage: "request.persist-user",
        code: "database",
        message: errorMessage(error),
        details: { sessionId: session.id },
      });
    }

    let reply;
    try {
      reply = await generateAssistantReply({
        systemPrompt: context.systemPrompt,
        history: historyForGemini(previous).slice(-context.maxHistoryMessages),
        userMessage: message,
      });
    } catch (error) {
      if (error instanceof GeminiRequestError) {
        throw error;
      }
      fail({
        status: 502,
        publicMessage: "The assistant could not complete that reply. Please try again.",
        stage: "request.gemini",
        code: "gemini",
        message: errorMessage(error),
        details: { sessionId: session.id },
      });
    }

    const cta: AiCta | null = buildCta({
      showCta: reply.showCta,
      reason: reply.ctaReason,
      userMessage: message,
      label: context.ctaLabel,
      href: context.ctaHref,
    });

    let assistantRow;
    try {
      assistantRow = await insertChatMessage(service, {
        sessionId: session.id,
        role: "assistant",
        content: reply.message,
        cta,
      });
      await touchSession(service, session.id);
    } catch (error) {
      fail({
        status: 500,
        publicMessage: "Could not save the assistant reply. Please try again.",
        stage: "request.persist-assistant",
        code: "database",
        message: errorMessage(error),
        details: { sessionId: session.id },
      });
    }

    const publicMessage = toPublicMessage(assistantRow);
    if (!publicMessage) {
      fail({
        status: 500,
        publicMessage: "Could not save the assistant reply.",
        stage: "request.parse-assistant",
        code: "database",
        details: { sessionId: session.id, role: assistantRow.role },
      });
    }

    logAiEvent("log", "request.success", {
      sessionId: session.id,
      authenticated: Boolean(userId),
      showCta: Boolean(cta),
      historyTurns: previous.length,
    });

    return withVisitorCookie(
      NextResponse.json({
        ok: true,
        sessionId: session.id,
        message: publicMessage,
        cta,
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
