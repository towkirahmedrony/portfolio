import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { buildAiAssistantContext } from "@/lib/ai/context";
import { buildCta } from "@/lib/ai/cta";
import { isGeminiConfigured } from "@/lib/ai/env";
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
import type { AiChatMessageRow } from "@/types/database";

export const dynamic = "force-dynamic";

const VISITOR_COOKIE = "ai_visitor_id";
const VISITOR_MAX_AGE = 60 * 60 * 24 * 365;
const MESSAGE_MAX = 4_000;
const HISTORY_FETCH_BUFFER = 2;

function jsonError(status: number, error: string) {
  const body: AiChatErrorResponse = { ok: false, error };
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

export async function GET(request: Request) {
  if (!isSupabaseConfigured() || !isServiceRoleConfigured()) {
    return jsonError(503, "The assistant is not configured yet.");
  }

  const sessionId = new URL(request.url).searchParams.get("sessionId");
  if (!isUuid(sessionId)) {
    return jsonError(400, "A valid sessionId is required.");
  }

  const { visitorId, setCookie } = await resolveVisitorId();
  const userClient = await createServerSupabaseClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();
  const service = createServiceRoleSupabaseClient();

  try {
    const session = await loadOwnedSession(service, {
      sessionId,
      userId: user?.id ?? null,
      visitorId,
    });

    if (!session) {
      return withVisitorCookie(
        jsonError(404, "Conversation not found."),
        visitorId,
        setCookie,
      );
    }

    const context = await buildAiAssistantContext();
    const rows = await listSessionMessages(
      service,
      session.id,
      context.maxHistoryMessages,
    );
    const messages = rows
      .map(toPublicMessage)
      .filter((message): message is AiChatMessage => message !== null);

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
    console.error("[ai-chat] history failed", {
      error: error instanceof Error ? error.message : "unknown error",
    });
    return withVisitorCookie(
      jsonError(500, "Could not load that conversation."),
      visitorId,
      setCookie,
    );
  }
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured() || !isServiceRoleConfigured()) {
    return jsonError(503, "The assistant is not configured yet.");
  }

  if (!isGeminiConfigured()) {
    return jsonError(503, "The assistant is not available right now.");
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonError(400, "Request body must be JSON.");
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return jsonError(400, "Request body must be a JSON object.");
  }

  const body = payload as { message?: unknown; sessionId?: unknown; visitorId?: unknown };
  if (body.visitorId !== undefined) {
    return jsonError(400, "Anonymous identity is managed by the server.");
  }
  const message = readJsonString(body.message);
  const requestedSessionId = readJsonString(body.sessionId);

  if (message.length === 0) {
    return jsonError(400, "Please enter a message.");
  }
  if (message.length > MESSAGE_MAX) {
    return jsonError(400, `Message must be ${MESSAGE_MAX} characters or fewer.`);
  }
  if (requestedSessionId && !isUuid(requestedSessionId)) {
    return jsonError(400, "A valid sessionId is required.");
  }

  const { visitorId, setCookie } = await resolveVisitorId();
  const userClient = await createServerSupabaseClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();
  const service = createServiceRoleSupabaseClient();
  const userId = user?.id ?? null;

  let context;
  try {
    context = await buildAiAssistantContext();
  } catch (error) {
    console.error("[ai-chat] context failed", {
      error: error instanceof Error ? error.message : "unknown error",
    });
    return withVisitorCookie(
      jsonError(503, "The assistant is not available right now."),
      visitorId,
      setCookie,
    );
  }

  if (!context.enabled) {
    return withVisitorCookie(
      jsonError(503, "The assistant is currently disabled."),
      visitorId,
      setCookie,
    );
  }

  let session = requestedSessionId
    ? await loadOwnedSession(service, {
        sessionId: requestedSessionId,
        userId,
        visitorId,
      })
    : null;

  if (requestedSessionId && !session) {
    return withVisitorCookie(
      jsonError(404, "Conversation not found."),
      visitorId,
      setCookie,
    );
  }

  try {
    if (!session) {
      session = await createChatSession(service, {
        userId,
        visitorId,
        title: titleFromMessage(message),
      });
    } else {
      session = await claimSessionIfNeeded(service, session, userId);
    }

    const previous = await listSessionMessages(
      service,
      session.id,
      context.maxHistoryMessages + HISTORY_FETCH_BUFFER,
    );

    await insertChatMessage(service, {
      sessionId: session.id,
      role: "user",
      content: message,
    });

    const reply = await generateAssistantReply({
      systemPrompt: context.systemPrompt,
      history: historyForGemini(previous).slice(-context.maxHistoryMessages),
      userMessage: message,
    });

    const cta: AiCta | null = buildCta({
      showCta: reply.showCta,
      reason: reply.ctaReason,
      userMessage: message,
      label: context.ctaLabel,
      href: context.ctaHref,
    });

    const assistantRow = await insertChatMessage(service, {
      sessionId: session.id,
      role: "assistant",
      content: reply.message,
      cta,
    });
    await touchSession(service, session.id);

    const publicMessage = toPublicMessage(assistantRow);
    if (!publicMessage) {
      return withVisitorCookie(
        jsonError(500, "Could not save the assistant reply."),
        visitorId,
        setCookie,
      );
    }

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
    console.error("[ai-chat] request failed", {
      error: error instanceof Error ? error.message : "unknown error",
    });
    return withVisitorCookie(
      jsonError(500, "Could not complete that conversation. Please try again."),
      visitorId,
      setCookie,
    );
  }
}
