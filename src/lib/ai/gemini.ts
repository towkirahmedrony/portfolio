import { getGeminiApiKey, getGeminiModel, isGeminiConfigured } from "@/lib/ai/env";
import { GeminiRequestError, logAiEvent } from "@/lib/ai/errors";

const GEMINI_TIMEOUT_MS = 20_000;
const GEMINI_ORIGIN = "https://generativelanguage.googleapis.com/v1beta";

export type GeminiChatTurn = {
  role: "user" | "assistant";
  content: string;
};

export type GeminiStructuredReply = {
  message: string;
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
  return parts
    .map((part) => part.text ?? "")
    .join("\n")
    .trim();
}

function stripFence(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced?.[1] ?? text).trim();
}

function parseStructuredReply(raw: string): GeminiStructuredReply | null {
  const text = stripFence(raw);
  if (!text) {
    return null;
  }

  try {
    const parsed = JSON.parse(text) as {
      message?: unknown;
      showCta?: unknown;
      ctaReason?: unknown;
    };
    if (typeof parsed.message !== "string" || parsed.message.trim().length === 0) {
      return null;
    }

    return {
      message: parsed.message.trim(),
      showCta: parsed.showCta === true,
      ctaReason:
        typeof parsed.ctaReason === "string" && parsed.ctaReason.trim().length > 0
          ? parsed.ctaReason.trim()
          : null,
    };
  } catch {
    return {
      message: text,
      showCta: false,
      ctaReason: null,
    };
  }
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

export async function generateAssistantReply(input: {
  systemPrompt: string;
  history: GeminiChatTurn[];
  userMessage: string;
}): Promise<GeminiStructuredReply> {
  const geminiApiKey = getGeminiApiKey();
  const geminiModel = getGeminiModel();

  if (!isGeminiConfigured() || !geminiApiKey) {
    throw new GeminiRequestError({
      message: "GEMINI_API_KEY is not configured.",
      status: 503,
      code: "auth",
    });
  }

  const contents = [
    ...input.history.map((turn) => ({
      role: turn.role === "assistant" ? "model" : "user",
      parts: [{ text: turn.content }],
    })),
    {
      role: "user",
      parts: [{ text: input.userMessage }],
    },
  ];

  const endpoint = `${GEMINI_ORIGIN}/models/${encodeURIComponent(geminiModel)}:generateContent`;

  logAiEvent("log", "gemini.request", {
    model: geminiModel,
    historyTurns: input.history.length,
    userMessageChars: input.userMessage.length,
    systemPromptChars: input.systemPrompt.length,
  });

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": geminiApiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: input.systemPrompt }],
        },
        contents,
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 1024,
          responseMimeType: "application/json",
        },
      }),
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

  const body = await response.text();
  let payload: GeminiResponse;
  try {
    payload = JSON.parse(body) as GeminiResponse;
  } catch {
    logAiEvent("error", "gemini.invalid-json", {
      httpStatus: response.status,
      bodyChars: body.length,
    });
    throw new GeminiRequestError({
      message: "Gemini returned a non-JSON body.",
      status: 502,
      code: "invalid",
      httpStatus: response.status,
    });
  }

  if (!response.ok) {
    const code = classifyHttpStatus(response.status);
    const upstream = payload.error?.message || payload.error?.status || `HTTP ${response.status}`;
    logAiEvent("error", "gemini.http-error", {
      httpStatus: response.status,
      code,
      upstreamStatus: payload.error?.status ?? null,
      upstreamCode: payload.error?.code ?? null,
      model: geminiModel,
    });
    throw new GeminiRequestError({
      message: `Gemini API error: ${upstream}`,
      status: code === "auth" || code === "not_found" ? 503 : code === "rate_limit" ? 429 : 502,
      code,
      httpStatus: response.status,
    });
  }

  const finishReason = payload.candidates?.[0]?.finishReason ?? null;
  const blockReason = payload.promptFeedback?.blockReason ?? null;
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

  const parsed = parseStructuredReply(extractText(payload));
  if (!parsed) {
    logAiEvent("error", "gemini.empty-reply", {
      finishReason,
      candidateCount: payload.candidates?.length ?? 0,
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

  logAiEvent("log", "gemini.success", {
    model: geminiModel,
    showCta: parsed.showCta,
    messageChars: parsed.message.length,
    finishReason,
  });

  return parsed;
}
