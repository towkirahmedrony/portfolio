import {
  getGeminiApiKey,
  getGeminiApiOrigin,
  getGeminiModel,
  getGeminiThinkingLevel,
  isGeminiConfigured,
  type GeminiThinkingLevel,
} from "@/lib/ai/env";
import { getRouteByHref, isAiRouteKey } from "@/lib/ai/cta";
import { GeminiRequestError, logAiEvent } from "@/lib/ai/errors";

const GEMINI_TIMEOUT_MS = 25_000;
/**
 * Some models reject `thinkingConfig` outright. If the first attempt fails with
 * a thinking-related 400 we retry once without it, so the latency tuning can
 * never turn into an outage.
 */
const THINKING_REJECTED_PATTERN =
  /thinking[\s_-]*(config|level|budget)|thinking_level|reasoning effort/i;
const INCOMPLETE_ACTION =
  /\s*\[\[(?:a(?:c(?:t(?:i(?:o(?:n(?::[a-z0-9-]*)?)?)?)?)?)?)?$/i;

export type GeminiChatTurn = {
  role: "user" | "assistant";
  content: string;
};

export type GeminiStructuredReply = {
  message: string;
  actionKey: string | null;
  showCta: boolean;
  ctaReason: string | null;
};

type GeminiPart = {
  text?: string;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: GeminiPart[];
    };
    finishReason?: string;
  }>;
  promptFeedback?: {
    blockReason?: string;
  };
  error?: {
    message?: string;
    status?: string;
    code?: number;
  };
};

function extractText(payload: GeminiResponse): string {
  const parts = payload.candidates?.[0]?.content?.parts ?? [];
  return parts.map((part) => part.text ?? "").join("");
}

function stripActionTags(value: string): string {
  return value.replace(/\s*\[\[action:[a-z0-9-]+\]\]/gi, "");
}

export function visibleStreamText(raw: string): string {
  const trimmed = raw.trimStart();
  if (trimmed.startsWith("{") || trimmed.startsWith("```")) {
    return "";
  }
  let text = stripActionTags(raw);
  const incomplete = text.search(INCOMPLETE_ACTION);
  if (incomplete >= 0) {
    text = text.slice(0, incomplete);
  }
  return text;
}

function stripFence(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced?.[1] ?? text).trim();
}

export function parseAssistantReply(raw: string): GeminiStructuredReply {
  const fenced = stripFence(raw);
  if (fenced.startsWith("{")) {
    try {
      const parsed = JSON.parse(fenced) as {
        message?: unknown;
        action?: unknown;
        actionKey?: unknown;
        showCta?: unknown;
        ctaReason?: unknown;
      };
      if (typeof parsed.message === "string" && parsed.message.trim()) {
        const action =
          parsed.action && typeof parsed.action === "object" && parsed.action !== null
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
          message: stripActionTags(parsed.message).trim(),
          actionKey,
          showCta: parsed.showCta === true || actionKey === "start-project",
          ctaReason:
            typeof parsed.ctaReason === "string" && parsed.ctaReason.trim()
              ? parsed.ctaReason.trim()
              : null,
        };
      }
    } catch {
      // Fall through to action-tag parsing.
    }
  }

  const match = raw.match(/\[\[action:([a-z0-9-]+)\]\]/i);
  const actionKey =
    match?.[1] && isAiRouteKey(match[1].toLowerCase())
      ? match[1].toLowerCase()
      : null;
  const message = stripActionTags(raw).trim();

  return {
    message,
    actionKey,
    showCta: actionKey === "start-project",
    ctaReason: null,
  };
}

function classifyHttpStatus(status: number): GeminiRequestError["code"] {
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

function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const name = "name" in error ? String(error.name) : "";
  return name === "TimeoutError" || name === "AbortError";
}

function buildRequestBody(
  input: {
    systemPrompt: string;
    history: GeminiChatTurn[];
    userMessage: string;
  },
  thinkingLevel: GeminiThinkingLevel | null,
) {
  return {
    systemInstruction: {
      parts: [{ text: input.systemPrompt }],
    },
    contents: [
      ...input.history.map((turn) => ({
        role: turn.role === "assistant" ? "model" : "user",
        parts: [{ text: turn.content }],
      })),
      {
        role: "user",
        parts: [{ text: input.userMessage }],
      },
    ],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 768,
      ...(thinkingLevel ? { thinkingConfig: { thinkingLevel } } : {}),
    },
  };
}

function geminiHttpError(status: number, bodyText: string, model: string): GeminiRequestError {
  let payload: GeminiResponse = {};
  try {
    payload = JSON.parse(bodyText) as GeminiResponse;
  } catch {
    payload = {};
  }

  const code = classifyHttpStatus(status);
  // Upstream error text is capped: it can echo part of the prompt, which must
  // never end up in logs or in a thrown message.
  const upstream = String(payload.error?.message || payload.error?.status || `HTTP ${status}`).slice(
    0,
    200,
  );
  logAiEvent("error", "gemini.http-error", {
    httpStatus: status,
    code,
    upstreamStatus: payload.error?.status ?? null,
    upstreamCode: payload.error?.code ?? null,
    model,
  });

  return new GeminiRequestError({
    message: `Gemini API error: ${upstream}`,
    status: code === "auth" || code === "not_found" ? 503 : code === "rate_limit" ? 429 : 502,
    code,
    httpStatus: status,
  });
}

async function* readSseTextDeltas(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<{ text?: string; payload: GeminiResponse }> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const consumeBlock = function* (block: string): Generator<{
    text?: string;
    payload: GeminiResponse;
  }> {
    const dataLines = block
      .split("\n")
      .map((line) => line.replace(/\r$/, ""))
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart());
    if (dataLines.length === 0) {
      const trimmed = block.trim();
      if (!trimmed || trimmed === "[DONE]") {
        return;
      }
      try {
        const payload = JSON.parse(trimmed) as GeminiResponse;
        const text = extractText(payload);
        yield { text: text || undefined, payload };
      } catch {
        return;
      }
      return;
    }

    const data = dataLines.join("\n").trim();
    if (!data || data === "[DONE]") {
      return;
    }
    try {
      const payload = JSON.parse(data) as GeminiResponse;
      const text = extractText(payload);
      yield { text: text || undefined, payload };
    } catch {
      return;
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    buffer = buffer.replace(/\r\n/g, "\n");

    let separator = buffer.indexOf("\n\n");
    while (separator >= 0) {
      const block = buffer.slice(0, separator);
      buffer = buffer.slice(separator + 2);
      yield* consumeBlock(block);
      separator = buffer.indexOf("\n\n");
    }
  }

  buffer += decoder.decode();
  const leftover = buffer.trim();
  if (leftover) {
    yield* consumeBlock(leftover);
  }
}

export async function* streamAssistantReply(input: {
  systemPrompt: string;
  history: GeminiChatTurn[];
  userMessage: string;
}): AsyncGenerator<
  { type: "delta"; text: string } | { type: "done"; reply: GeminiStructuredReply; firstTokenMs: number | null }
> {
  const geminiApiKey = getGeminiApiKey();
  const geminiModel = getGeminiModel();
  const thinkingLevel = getGeminiThinkingLevel();
  const origin = getGeminiApiOrigin();

  if (!isGeminiConfigured() || !geminiApiKey) {
    throw new GeminiRequestError({
      message: "GEMINI_API_KEY is not configured.",
      status: 503,
      code: "auth",
    });
  }

  const endpoint = `${origin}/models/${encodeURIComponent(geminiModel)}:streamGenerateContent?alt=sse`;

  logAiEvent("log", "gemini.request", {
    model: geminiModel,
    stream: true,
    thinkingLevel: thinkingLevel ?? "model-default",
    historyTurns: input.history.length,
    userMessageChars: input.userMessage.length,
    systemPromptChars: input.systemPrompt.length,
  });

  const geminiStartedAt = Date.now();
  let firstTokenAt: number | null = null;

  const postStream = async (body: unknown): Promise<Response> => {
    try {
      return await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
          "x-goog-api-key": geminiApiKey,
        },
        body: JSON.stringify(body),
        cache: "no-store",
        signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
      });
    } catch (error) {
      if (isAbortError(error)) {
        throw new GeminiRequestError({
          message: `Gemini request timed out after ${GEMINI_TIMEOUT_MS}ms.`,
          status: 504,
          code: "timeout",
        });
      }
      throw new GeminiRequestError({
        message: error instanceof Error ? error.message : "Gemini network request failed.",
        status: 502,
        code: "network",
      });
    }
  };

  let response = await postStream(buildRequestBody(input, thinkingLevel));

  if (!response.ok && thinkingLevel && response.status === 400) {
    const bodyText = await response.text().catch(() => "");
    if (THINKING_REJECTED_PATTERN.test(bodyText)) {
      logAiEvent("log", "gemini.thinking-unsupported", {
        model: geminiModel,
        thinkingLevel,
      });
      response = await postStream(buildRequestBody(input, null));
    } else {
      throw geminiHttpError(response.status, bodyText, geminiModel);
    }
  }

  if (!response.ok) {
    const bodyText = await response.text().catch(() => "");
    throw geminiHttpError(response.status, bodyText, geminiModel);
  }

  if (!response.body) {
    throw new GeminiRequestError({
      message: "Gemini returned an empty stream.",
      status: 502,
      code: "empty",
      httpStatus: response.status,
    });
  }

  let raw = "";
  let visible = "";
  let finishReason: string | null = null;
  let blockReason: string | null = null;

  const stream = readSseTextDeltas(response.body);

  while (true) {
    let step: IteratorResult<{ text?: string; payload: GeminiResponse }>;
    try {
      step = await stream.next();
    } catch (error) {
      // The request-level timeout also aborts an in-flight stream.
      if (isAbortError(error)) {
        throw new GeminiRequestError({
          message: `Gemini stream aborted after ${GEMINI_TIMEOUT_MS}ms.`,
          status: 504,
          code: "timeout",
        });
      }
      throw error;
    }

    if (step.done) {
      break;
    }

    const chunk = step.value;

    if (chunk.payload.error?.message) {
      logAiEvent("error", "gemini.stream-error", {
        model: geminiModel,
        upstreamStatus: chunk.payload.error.status ?? null,
        upstreamCode: chunk.payload.error.code ?? null,
      });
      throw new GeminiRequestError({
        message: `Gemini API error: ${String(chunk.payload.error.message).slice(0, 200)}`,
        status: 502,
        code: "upstream",
      });
    }

    finishReason = chunk.payload.candidates?.[0]?.finishReason ?? finishReason;
    blockReason = chunk.payload.promptFeedback?.blockReason ?? blockReason;

    if (chunk.text) {
      if (chunk.text.startsWith(raw) && chunk.text.length >= raw.length) {
        raw = chunk.text;
      } else {
        raw += chunk.text;
      }
      const nextVisible = visibleStreamText(raw);
      if (nextVisible.length > visible.length) {
        const delta = nextVisible.slice(visible.length);
        visible = nextVisible;
        if (delta) {
          if (firstTokenAt == null) {
            firstTokenAt = Date.now() - geminiStartedAt;
          }
          yield { type: "delta", text: delta };
        }
      }
    }
  }

  if (blockReason || finishReason === "SAFETY" || finishReason === "BLOCKLIST") {
    logAiEvent("error", "gemini.blocked", {
      finishReason,
      blockReason,
      model: geminiModel,
    });
    throw new GeminiRequestError({
      message: `Gemini blocked the reply (${blockReason || finishReason}).`,
      status: 422,
      code: "blocked",
      finishReason,
      httpStatus: response.status,
    });
  }

  const reply = parseAssistantReply(raw);
  if (!reply.message) {
    logAiEvent("error", "gemini.empty-reply", {
      finishReason,
      model: geminiModel,
    });
    throw new GeminiRequestError({
      message: "Gemini returned an empty reply.",
      status: 502,
      code: "empty",
      finishReason,
      httpStatus: response.status,
    });
  }

  logAiEvent("log", "gemini.timing", {
    gemini: Date.now() - geminiStartedAt,
    geminiFirstToken: firstTokenAt,
    model: geminiModel,
    stream: true,
    thinkingLevel: thinkingLevel ?? "model-default",
    actionKey: reply.actionKey,
    messageChars: reply.message.length,
    finishReason,
  });

  yield { type: "done", reply, firstTokenMs: firstTokenAt };
}

export async function generateAssistantReply(input: {
  systemPrompt: string;
  history: GeminiChatTurn[];
  userMessage: string;
}): Promise<GeminiStructuredReply> {
  let reply: GeminiStructuredReply | null = null;
  for await (const event of streamAssistantReply(input)) {
    if (event.type === "done") {
      reply = event.reply;
    }
  }
  if (!reply) {
    throw new GeminiRequestError({
      message: "Gemini returned an empty reply.",
      status: 502,
      code: "empty",
    });
  }
  return reply;
}
