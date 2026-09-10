"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  AI_MESSAGE_MAX,
  createLocalAiMessage,
  clearStoredAiSessionId,
  loadAiChatHistory,
  readStoredAiSessionId,
  sendAiChatMessage,
  storeAiSessionId,
} from "@/lib/ai/client";
import type { AiChatMessage, AiCta } from "@/types/ai";

const SUGGESTIONS = [
  "What kind of websites do you build?",
  "Can you help with a web app?",
  "How do I start a project?",
] as const;

type ProjectAssistantProps = {
  compact?: boolean;
  className?: string;
  title?: string;
  description?: string;
};

function latestCta(messages: AiChatMessage[]): AiCta | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const cta = messages[index]?.cta;
    if (cta) {
      return cta;
    }
  }
  return null;
}

function AssistantIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 4.5c.8 2.6 2.9 4.7 5.5 5.5-2.6.8-4.7 2.9-5.5 5.5-.8-2.6-2.9-4.7-5.5-5.5 2.6-.8 4.7-2.9 5.5-5.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M6.5 16.5c.35 1.15 1.25 2.05 2.4 2.4-1.15.35-2.05 1.25-2.4 2.4-.35-1.15-1.25-2.05-2.4-2.4 1.15-.35 2.05-1.25 2.4-2.4Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ProjectAssistant({
  compact = false,
  className,
  title = "Ask about a website or web app",
  description = "Get a quick, factual answer about working together. For a quote or a new build, use Start a Project.",
}: ProjectAssistantProps) {
  const formId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        setMessages(history.messages);
      })
      .catch(() => {
        if (!cancelled) {
          clearStoredAiSessionId();
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
    root.scrollTo({ top: root.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

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

  const canSend = draft.trim().length > 0 && !sending;

  async function sendMessage(raw: string) {
    const message = raw.trim();
    if (!message || sending) {
      return;
    }
    if (message.length > AI_MESSAGE_MAX) {
      setError(`Message must be ${AI_MESSAGE_MAX} characters or fewer.`);
      return;
    }

    const optimistic = createLocalAiMessage("user", message);
    setMessages((current) => [...current, optimistic]);
    setDraft("");
    setError(null);
    setSending(true);

    try {
      const result = await sendAiChatMessage({
        message,
        sessionId,
      });
      storeAiSessionId(result.sessionId);
      setSessionId(result.sessionId);
      setMessages((current) => [
        ...current.filter((item) => item.id !== optimistic.id),
        { ...optimistic, id: `user-${result.message.id}` },
        result.message,
      ]);
    } catch (sendError) {
      setMessages((current) => current.filter((item) => item.id !== optimistic.id));
      setDraft(message);
      setError(
        sendError instanceof Error
          ? sendError.message
          : "Could not send that message. Please try again.",
      );
    } finally {
      setSending(false);
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

  const cta = latestCta(messages);
  const showEmpty = messages.length === 0 && !sending;

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
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-card text-accent">
          <AssistantIcon />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-[0.22em] text-accent uppercase">
            Project assistant
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

      <div
        ref={listRef}
        className={cn(
          "overflow-y-auto overscroll-contain bg-background/50 px-4 py-5 sm:px-6",
          compact ? "h-[22rem]" : "h-[26rem] sm:h-[28rem]",
        )}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label="Project assistant conversation"
      >
        {showEmpty ? (
          <div className="flex h-full flex-col justify-end gap-5">
            <div className="max-w-[90%] rounded-2xl rounded-bl-md border border-card-border bg-background px-4 py-3 text-sm leading-6 text-foreground sm:max-w-[80%]">
              <p>
                Ask about websites, web apps, process, or how to start. I only
                answer from published information — if something is not listed,
                I will say so.
              </p>
            </div>
            <div>
              <p className="mb-2 text-[11px] font-medium tracking-[0.16em] text-muted uppercase">
                Try asking
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                {SUGGESTIONS.map((suggestion) => (
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
            {messages.map((message) => {
              const isUser = message.role === "user";
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
                    <p className="whitespace-pre-wrap break-words">{message.content}</p>
                  </div>
                </div>
              );
            })}
            {sending ? (
              <div
                className="self-start max-w-[80%] rounded-2xl rounded-bl-md border border-card-border bg-background px-4 py-3 text-sm text-muted"
                role="status"
              >
                Thinking…
              </div>
            ) : null}
          </div>
        )}
      </div>

      {cta ? (
        <div className="flex flex-col gap-3 border-t border-card-border bg-accent-soft px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-sm leading-6 text-foreground">
            {cta.reason || "Ready to brief a website or web app?"}
          </p>
          <ButtonLink href={cta.href} size="md" className="shrink-0">
            {cta.label}
          </ButtonLink>
        </div>
      ) : null}

      <div className="border-t border-card-border bg-card px-3 py-3 sm:px-5 sm:py-4">
        {error ? (
          <p className="mb-2 px-1 text-xs text-accent" role="alert">
            {error}
          </p>
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
            placeholder="Ask about a website or web app… (Enter to send)"
            className="min-h-12 w-full resize-none rounded-2xl border border-card-border bg-background px-4 py-3 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60 sm:min-h-11 sm:text-sm"
          />
          <Button
            type="submit"
            size="md"
            disabled={!canSend}
            aria-label={sending ? "Sending message" : "Send message"}
            className="h-12 shrink-0 px-5 sm:h-11"
          >
            {sending ? "Sending" : "Send"}
          </Button>
        </form>
        <p className="mt-2 hidden px-1 text-[11px] text-muted sm:block">
          Enter to send · Shift + Enter for a new line
        </p>
      </div>
    </section>
  );
}
