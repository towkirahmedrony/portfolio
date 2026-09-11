"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { AssistantIcon } from "@/components/ai/assistant-icon";
import { MessageText } from "@/components/ai/message-text";
import { Button, ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  AI_MESSAGE_MAX,
  createLocalAiMessage,
  clearStoredAiSessionId,
  loadAiChatHistory,
  loadAiUiConfig,
  readStoredAiSessionId,
  sendAiChatMessage,
  storeAiSessionId,
} from "@/lib/ai/client";
import { DEFAULT_AI_UI_CONFIG } from "@/lib/ai/ui-defaults";
import type { AiChatMessage, AiCta, AiUiConfig } from "@/types/ai";

type ProjectAssistantProps = {
  variant?: "card" | "page";
  compact?: boolean;
  className?: string;
  title?: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
};

function AssistantAvatar({
  avatar,
  avatarType,
}: {
  avatar: string | null;
  avatarType: AiUiConfig["avatarType"];
}) {
  if (avatar && (avatarType === "image" || /^https?:\/\//i.test(avatar))) {
    return <img src={avatar} alt="" className="h-full w-full rounded-full object-cover" />;
  }
  if (avatar) {
    return (
      <span className="text-lg leading-none" aria-hidden>
        {avatar}
      </span>
    );
  }
  return <AssistantIcon />;
}

function ThinkingIndicator() {
  return (
    <p className="text-muted" role="status">
      Thinking
      <span className="inline-flex items-baseline" aria-hidden>
        <span className="animate-pulse">.</span>
        <span className="animate-pulse [animation-delay:150ms]">.</span>
        <span className="animate-pulse [animation-delay:300ms]">.</span>
      </span>
    </p>
  );
}

function HistorySkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden>
      <div className="h-14 max-w-[80%] animate-pulse rounded-2xl rounded-bl-md border border-card-border bg-background" />
      <div className="ml-auto h-10 max-w-[55%] animate-pulse rounded-2xl rounded-br-md bg-accent/15" />
      <div className="h-16 max-w-[72%] animate-pulse rounded-2xl rounded-bl-md border border-card-border bg-background" />
    </div>
  );
}

function mergeHistoryMessages(
  current: AiChatMessage[],
  historyMessages: AiChatMessage[],
): AiChatMessage[] {
  if (current.length === 0) {
    return historyMessages;
  }
  const historyIds = new Set(historyMessages.map((item) => item.id));
  const extras = current.filter(
    (item) => !historyIds.has(item.id) && item.id.startsWith("local-"),
  );
  return extras.length > 0 ? [...historyMessages, ...extras] : historyMessages;
}

function MessageCta({ cta }: { cta: AiCta }) {
  return (
    <ButtonLink
      href={cta.href}
      size="md"
      className="mt-2 h-9 self-start px-4 text-xs"
    >
      {cta.label}
    </ButtonLink>
  );
}

export function ProjectAssistant({
  variant = "card",
  compact = false,
  className,
  title = "Ask about a website or web app",
  description = "Get a quick, factual answer about working together. For a quote or a new build, use Start a Project.",
  backHref = "/",
  backLabel = "Back",
}: ProjectAssistantProps) {
  const isPage = variant === "page";
  const formId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sendingRef = useRef(false);
  const messagesRef = useRef<AiChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(() =>
    readStoredAiSessionId(),
  );
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryMessage, setRetryMessage] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(() => Boolean(readStoredAiSessionId()));
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [liveHeight, setLiveHeight] = useState<number | null>(null);
  const [uiConfig, setUiConfig] = useState<AiUiConfig>(DEFAULT_AI_UI_CONFIG);
  messagesRef.current = messages;

  const loadHistory = useCallback(async (stored: string) => {
    setHistoryError(null);

    try {
      const history = await loadAiChatHistory(stored);
      setSessionId(history.sessionId);
      storeAiSessionId(history.sessionId);
      setMessages((current) => mergeHistoryMessages(current, history.messages));
      setHistoryError(null);
    } catch (loadError) {
      if (messagesRef.current.length === 0 && !sendingRef.current) {
        clearStoredAiSessionId();
        setSessionId(null);
        setHistoryError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load that conversation.",
        );
      }
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    const stored = readStoredAiSessionId();
    if (!stored) {
      return;
    }

    let cancelled = false;
    void loadAiChatHistory(stored)
      .then((history) => {
        if (cancelled) {
          return;
        }
        setSessionId(history.sessionId);
        storeAiSessionId(history.sessionId);
        setMessages((current) => mergeHistoryMessages(current, history.messages));
        setHistoryError(null);
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return;
        }
        if (messagesRef.current.length === 0 && !sendingRef.current) {
          clearStoredAiSessionId();
          setSessionId(null);
          setHistoryError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load that conversation.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setHistoryLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadAiUiConfig().then((config) => {
      if (!cancelled) {
        setUiConfig(config);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const root = listRef.current;
    if (!root) {
      return;
    }
    const distance = root.scrollHeight - root.scrollTop - root.clientHeight;
    if (distance < 120) {
      root.scrollTo({ top: root.scrollHeight, behavior: sending ? "auto" : "smooth" });
    }
  }, [messages, sending, streaming, historyLoading]);

  const resizeDraft = useCallback(() => {
    const field = textareaRef.current;
    if (!field) {
      return;
    }
    field.style.height = "auto";
    field.style.height = `${Math.min(field.scrollHeight, 160)}px`;
  }, []);

  useEffect(() => {
    resizeDraft();
  }, [draft, resizeDraft]);

  useEffect(() => {
    if (!isPage) {
      return;
    }

    const viewport = window.visualViewport;
    if (!viewport) {
      return;
    }

    const update = () => {
      const height = Math.max(0, Math.round(viewport.height));
      setLiveHeight((prev) => (prev === height ? prev : height));
      if (rootRef.current) {
        rootRef.current.style.top = `${Math.round(viewport.offsetTop)}px`;
      }
    };

    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    update();

    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [isPage]);

  const canSend = draft.trim().length > 0 && !sending;

  async function sendMessage(raw: string) {
    const message = raw.trim();
    if (!message || sending || sendingRef.current) {
      return;
    }
    if (message.length > AI_MESSAGE_MAX) {
      setError(`Message must be ${AI_MESSAGE_MAX} characters or fewer.`);
      setRetryMessage(message);
      return;
    }
    sendingRef.current = true;

    const optimistic = createLocalAiMessage("user", message);
    const assistantDraft = createLocalAiMessage("assistant", "");
    setMessages((current) => {
      const last = current[current.length - 1];
      if (last?.role === "user" && last.content === message) {
        return [...current, assistantDraft];
      }
      return [...current, optimistic, assistantDraft];
    });
    setDraft("");
    setError(null);
    setRetryMessage(null);
    setSending(true);
    setStreaming(false);

    try {
      const result = await sendAiChatMessage(
        {
          message,
          sessionId,
        },
        {
          onSession: (nextSessionId) => {
            storeAiSessionId(nextSessionId);
            setSessionId(nextSessionId);
          },
          onDelta: (text) => {
            setStreaming(true);
            setMessages((current) =>
              current.map((item) =>
                item.id === assistantDraft.id
                  ? { ...item, content: `${item.content}${text}` }
                  : item,
              ),
            );
          },
        },
      );
      storeAiSessionId(result.sessionId);
      setSessionId(result.sessionId);
      setMessages((current) =>
        current.map((item) => {
          if (item.id === optimistic.id) {
            return { ...optimistic, id: `user-${result.message.id}` };
          }
          if (item.id === assistantDraft.id) {
            return result.message;
          }
          return item;
        }),
      );
    } catch (sendError) {
      setMessages((current) => current.filter((item) => item.id !== assistantDraft.id));
      setRetryMessage(message);
      setError(
        sendError instanceof Error
          ? sendError.message
          : "Could not send that message. Please try again.",
      );
    } finally {
      sendingRef.current = false;
      setSending(false);
      setStreaming(false);
      textareaRef.current?.focus();
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(draft);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }
    event.preventDefault();
    void sendMessage(draft);
  }

  const showEmpty = messages.length === 0 && !sending && !historyLoading;

  const composer = (
    <div
      className={cn(
        "border-t border-card-border bg-card",
        isPage
          ? "px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5 sm:py-4"
          : "px-3 py-3 sm:px-5 sm:py-4",
      )}
    >
      {error ? (
        <div className="mb-2 flex items-start justify-between gap-3 px-1" role="alert">
          <p className="text-xs leading-5 text-accent">{error}</p>
          {retryMessage ? (
            <button
              type="button"
              onClick={() => void sendMessage(retryMessage)}
              disabled={sending}
              className="shrink-0 rounded-full border border-card-border bg-background px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors hover:border-accent/40 disabled:opacity-60"
            >
              Retry
            </button>
          ) : null}
        </div>
      ) : null}
      <form
        onSubmit={handleSubmit}
        className="flex items-end gap-2"
        aria-busy={sending}
      >
        <label htmlFor={`${formId}-message`} className="sr-only">
          Message the project assistant
        </label>
        <textarea
          id={`${formId}-message`}
          ref={textareaRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          maxLength={AI_MESSAGE_MAX}
          disabled={sending}
          enterKeyHint="send"
          placeholder={uiConfig.inputPlaceholder}
          className="min-h-12 w-full resize-none rounded-2xl border border-card-border bg-background px-4 py-3 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60 sm:min-h-11 sm:text-sm"
        />
        <Button
          type="submit"
          size="md"
          disabled={!canSend}
            aria-label={sending ? "Sending message" : "Send message"}
            className="h-12 shrink-0 px-5 sm:h-11"
          >
            {sending ? "Wait" : "Send"}
        </Button>
      </form>
      <p className="mt-2 hidden px-1 text-[11px] text-muted sm:block">
        Enter to send · Shift + Enter for a new line
      </p>
    </div>
  );

  const thread = (
    <div
      ref={listRef}
      className={cn(
        "overflow-y-auto overscroll-contain bg-background/50 px-4 py-5 sm:px-6",
        isPage
          ? "min-h-0 flex-1"
          : compact
            ? "h-[22rem]"
            : "h-[26rem] sm:h-[28rem]",
      )}
      role="log"
      aria-live="polite"
      aria-relevant="additions"
      aria-label="Project assistant conversation"
    >
      {historyLoading && messages.length === 0 ? (
        <HistorySkeleton />
      ) : historyError && messages.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="text-sm text-muted" role="alert">
            {historyError}
          </p>
          <button
            type="button"
            onClick={() => {
              const stored = readStoredAiSessionId();
              if (!stored) {
                setHistoryError(null);
                return;
              }
              setHistoryLoading(true);
              void loadHistory(stored);
            }}
            className="rounded-full border border-card-border bg-card px-4 py-2 text-xs font-medium text-foreground transition-colors hover:border-accent/40"
          >
            Try again
          </button>
        </div>
      ) : showEmpty ? (
        <div className="flex h-full flex-col justify-end gap-5">
          <div className="max-w-[90%] rounded-2xl rounded-bl-md border border-card-border bg-background px-4 py-3 text-sm leading-6 text-foreground sm:max-w-[80%]">
            <p className="whitespace-pre-wrap">{uiConfig.welcomeMessage}</p>
          </div>
          <div>
            <p className="mb-2 text-[11px] font-medium tracking-[0.16em] text-muted uppercase">
              Try asking
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {uiConfig.suggestedQuestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  disabled={sending}
                  onClick={() => void sendMessage(suggestion)}
                  className="rounded-full border border-card-border bg-card px-3.5 py-2 text-left text-xs font-medium text-foreground transition-colors hover:border-accent/40 hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {messages.map((message, index) => {
            const isUser = message.role === "user";
            const isLatest = index === messages.length - 1;
            const isStreamingDraft =
              sending && isLatest && !isUser && message.content.length === 0 && !streaming;
            return (
              <div key={message.id} className="flex flex-col">
                <div
                  className={cn(
                    "max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-6 sm:max-w-[80%]",
                    isUser
                      ? "self-end rounded-br-md bg-accent text-accent-foreground"
                      : "self-start rounded-bl-md border border-card-border bg-background text-foreground",
                  )}
                >
                  {isStreamingDraft ? (
                    <ThinkingIndicator />
                  ) : (
                    <MessageText
                      content={message.content}
                      showCursor={sending && isLatest && !isUser && streaming}
                    />
                  )}
                </div>
                {!isUser && message.cta ? <MessageCta cta={message.cta} /> : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  if (isPage) {
    return (
      <section
        ref={rootRef}
        id="project-assistant"
        className={cn(
          "fixed inset-x-0 top-0 flex min-h-0 w-full flex-col overflow-hidden bg-card",
          className,
        )}
        style={liveHeight !== null ? { height: liveHeight } : { height: "100dvh" }}
        aria-labelledby={`${formId}-title`}
      >
        <header className="flex items-center gap-3 border-b border-card-border bg-card px-3 py-2.5 sm:px-4">
          <Link
            href={backHref}
            aria-label={`${backLabel} to the site`}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-card-border bg-background px-3.5 text-xs font-semibold text-foreground transition-colors hover:border-accent/40 hover:text-accent"
          >
            <span aria-hidden>&larr;</span>
            {backLabel}
          </Link>
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "text-[11px] font-medium tracking-[0.18em] uppercase",
                !uiConfig.themeColor && "text-accent",
              )}
              style={uiConfig.themeColor ? { color: uiConfig.themeColor } : undefined}
            >
              {uiConfig.name}
            </p>
            <h1
              id={`${formId}-title`}
              className="font-display truncate text-base tracking-tight sm:text-lg"
            >
              {title}
            </h1>
          </div>
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent-soft text-accent">
            <AssistantAvatar avatar={uiConfig.avatar} avatarType={uiConfig.avatarType} />
          </span>
        </header>
        {thread}
        {composer}
      </section>
    );
  }

  return (
    <section
      id="project-assistant"
      className={cn(
        "scroll-mt-24 overflow-hidden rounded-3xl border border-card-border bg-card shadow-[0_1px_0_rgba(20,20,20,0.04)] dark:shadow-none",
        className,
      )}
      aria-labelledby={`${formId}-title`}
    >
      <div className="flex items-start gap-4 border-b border-card-border bg-accent-soft/70 px-5 py-5 sm:px-7 sm:py-6">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-card text-accent">
          <AssistantAvatar avatar={uiConfig.avatar} avatarType={uiConfig.avatarType} />
        </span>
        <div className="min-w-0">
          <p
            className={cn(
              "text-xs font-medium tracking-[0.22em] uppercase",
              !uiConfig.themeColor && "text-accent",
            )}
            style={uiConfig.themeColor ? { color: uiConfig.themeColor } : undefined}
          >
            {uiConfig.name}
          </p>
          <h2
            id={`${formId}-title`}
            className="font-display mt-1 text-xl tracking-tight sm:text-2xl"
          >
            {title}
          </h2>
          {description ? (
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {thread}
      {composer}
    </section>
  );
}
