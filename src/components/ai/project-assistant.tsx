"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
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
  deleteAiConversation,
  loadAiChatHistory,
  loadAiUiConfig,
  readAiHistoryCache,
  readStoredAiSessionId,
  sendAiChatMessage,
  startNewAiConversation,
  storeAiSessionId,
  writeAiHistoryCache,
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
  // A broken image must never show: an unusable value falls back to the icon.
  if (avatar && (avatarType === "image" || /^https?:\/\//i.test(avatar))) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- remote assistant avatar from Dify
      <img
        src={avatar}
        alt=""
        className="h-full w-full rounded-full object-cover"
        onError={(event) => {
          event.currentTarget.style.display = "none";
        }}
      />
    );
  }
  if (avatar && avatarType === "emoji") {
    return (
      <span className="text-lg leading-none" aria-hidden>
        {avatar}
      </span>
    );
  }
  return <AssistantIcon />;
}

/** Avatar shown next to the assistant's own messages and in the welcome state. */
function MessageAvatar({ config }: { config: AiUiConfig }) {
  return (
    <span className="mb-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-card-border bg-accent-soft text-accent">
      <AssistantAvatar avatar={config.avatar} avatarType={config.avatarType} />
    </span>
  );
}

function ThinkingIndicator() {
  return (
    <p className="flex items-center gap-1.5 text-muted" role="status">
      <span className="sr-only">Nora is thinking</span>
      <span aria-hidden className="inline-flex items-baseline gap-0.5">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:300ms]" />
      </span>
    </p>
  );
}

function HistorySkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden>
      <div className="h-14 max-w-[80%] animate-pulse rounded-2xl rounded-bl-md border border-card-border bg-card" />
      <div className="ml-auto h-10 max-w-[55%] animate-pulse rounded-2xl rounded-br-md bg-accent/15" />
      <div className="h-16 max-w-[72%] animate-pulse rounded-2xl rounded-bl-md border border-card-border bg-card" />
    </div>
  );
}

function SendIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="translate-x-px"
    >
      <path
        d="M5 12h13M12.5 5.5 19 12l-6.5 6.5"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
      <path
        d="M20 12a8 8 0 0 0-8-8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="5.5" r="1.7" />
      <circle cx="12" cy="12" r="1.7" />
      <circle cx="12" cy="18.5" r="1.7" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 7h14M10 7V5.5h4V7M7 7l.8 11a1.5 1.5 0 0 0 1.5 1.4h5.4a1.5 1.5 0 0 0 1.5-1.4L17 7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function NewChatIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

const EMPTY_MESSAGES: AiChatMessage[] = [];

type RestoreState = "loading" | "done";

function subscribeNever() {
  return () => {};
}

/**
 * Same helper the project-request form uses: `false` while the server and the
 * first hydration render own the tree, `true` once the client does. Values read
 * from browser storage are only rendered through it, so hydration always
 * matches and cached data still appears immediately afterwards.
 */
function useIsClient() {
  return useSyncExternalStore(subscribeNever, () => true, () => false);
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
    <ButtonLink href={cta.href} size="md" className="mt-2 h-9 self-start px-4 text-xs">
      {cta.label}
    </ButtonLink>
  );
}

export function ProjectAssistant({
  variant = "card",
  compact = false,
  className,
  title = "AI Project Assistant",
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
  /**
   * Bumped whenever the conversation is replaced (new chat / delete). A reply
   * that lands after that belongs to a conversation the user has left, so it is
   * dropped instead of being mixed into the fresh thread.
   */
  const generationRef = useRef(0);
  const isClient = useIsClient();

  /**
   * One-shot read of the caches at mount. The cached conversation (5-minute
   * TTL) becomes the initial state, so it renders immediately with no history
   * request; `restore.state` records whether a silent fetch is still needed.
   */
  const [restoreState, setRestoreState] = useState<RestoreState>(() => {
    if (typeof window === "undefined") {
      return "done";
    }
    if (readAiHistoryCache()) {
      return "done";
    }
    return readStoredAiSessionId() ? "loading" : "done";
  });
  const [restore] = useState(() => {
    if (typeof window === "undefined") {
      return { cached: null, storedSessionId: null as string | null };
    }
    return {
      cached: readAiHistoryCache(),
      storedSessionId: readStoredAiSessionId(),
    };
  });

  const [sessionId, setSessionId] = useState<string | null>(
    restore.cached?.sessionId ?? restore.storedSessionId,
  );
  const [messages, setMessages] = useState<AiChatMessage[]>(
    restore.cached?.messages ?? [],
  );
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryMessage, setRetryMessage] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [liveHeight, setLiveHeight] = useState<number | null>(null);
  const [uiConfig, setUiConfig] = useState<AiUiConfig>(DEFAULT_AI_UI_CONFIG);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Everything derived from browser storage is only rendered once the client
  // owns the tree, so the server HTML and the first hydration render match.
  const visibleMessages = isClient ? messages : EMPTY_MESSAGES;
  const activeSessionId = isClient ? sessionId : null;

  // Kept in a ref so async callbacks can read the newest messages without
  // being re-created (and without writing to a ref during render).
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  /**
   * Restores the conversation when a silent fetch is needed.
   *
   * A fresh cache is already in state, so nothing is fetched at all — navigating
   * back to /ai-assistant renders the conversation instantly with no history
   * request. History is only fetched when the cache is missing or older than its
   * TTL, and the fetch is silent (no "loading" copy is ever rendered). Every
   * state update happens in an async callback, never synchronously in the effect
   * body, so the render is not cascaded.
   */
  useEffect(() => {
    if (restoreState !== "loading" || !restore.storedSessionId) {
      return;
    }

    let cancelled = false;

    void loadAiChatHistory(restore.storedSessionId)
      .then((history) => {
        if (cancelled) {
          return;
        }
        setSessionId(history.sessionId);
        storeAiSessionId(history.sessionId);
        setMessages((current) => mergeHistoryMessages(current, history.messages));
        setHistoryError(null);
        // The cache is refreshed by the effect below once the messages settle.
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
          setRestoreState("done");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [restoreState, restore.storedSessionId]);

  /**
   * Keeps the cached conversation in step with what is on screen. Optimistic
   * (`local-`) messages are filtered out by `writeAiHistoryCache`, so a failed
   * or in-flight message can never be cached, and the cache always holds exactly
   * the server-derived list — which is what makes merging duplicates-safe.
   */
  useEffect(() => {
    if (!isClient || !sessionId || sending || restoreState === "loading") {
      return;
    }
    writeAiHistoryCache(sessionId, messages);
  }, [messages, sessionId, sending, restoreState, isClient]);

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
  }, [messages, sending, streaming, restoreState]);

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

  // Keep the composer visible when the Android keyboard opens: the page section
  // tracks the visual viewport instead of the layout viewport.
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

  // The header menu closes on outside click and on Escape.
  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!confirmingDelete) {
      return;
    }
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape" && !deleting) {
        setConfirmingDelete(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [confirmingDelete, deleting]);

  const canSend = draft.trim().length > 0 && !sending;

  /** Resets the thread locally and forgets the stored session id. */
  const resetConversation = useCallback(() => {
    generationRef.current += 1;
    startNewAiConversation();
    sendingRef.current = false;
    setSessionId(null);
    setMessages([]);
    setDraft("");
    setError(null);
    setRetryMessage(null);
    setSending(false);
    setStreaming(false);
    setRestoreState("done");
    setHistoryError(null);
    setMenuOpen(false);
    setConfirmingDelete(false);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, []);

  async function confirmDeleteConversation() {
    setDeleting(true);
    const deletingSessionId = activeSessionId;
    try {
      if (deletingSessionId) {
        await deleteAiConversation(deletingSessionId);
      }
      resetConversation();
    } catch (deleteError) {
      setConfirmingDelete(false);
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Could not delete that conversation. Please try again.",
      );
    } finally {
      setDeleting(false);
    }
  }

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
    const generation = generationRef.current;

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
          sessionId: activeSessionId,
        },
        {
          onSession: (nextSessionId) => {
            if (generationRef.current !== generation) {
              return;
            }
            storeAiSessionId(nextSessionId);
            setSessionId(nextSessionId);
          },
          onDelta: (text) => {
            if (generationRef.current !== generation) {
              return;
            }
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
      if (generationRef.current !== generation) {
        return;
      }
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
      if (generationRef.current !== generation) {
        return;
      }
      setMessages((current) => current.filter((item) => item.id !== assistantDraft.id));
      setRetryMessage(message);
      setError(
        sendError instanceof Error
          ? sendError.message
          : "Could not send that message. Please try again.",
      );
    } finally {
      if (generationRef.current === generation) {
        sendingRef.current = false;
        setSending(false);
        setStreaming(false);
        textareaRef.current?.focus();
      }
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

  /**
   * Silent restore: a skeleton only when there is something to restore (a
   * stored session whose cache expired) and nothing to show yet. A cached
   * conversation never shows it, and no "loading" copy is ever rendered.
   */
  const showSkeleton =
    isClient &&
    restoreState === "loading" &&
    visibleMessages.length === 0 &&
    !historyError;
  const showEmpty = visibleMessages.length === 0 && !sending && !showSkeleton;

  const headerMenu = (
    <div ref={menuRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setMenuOpen((open) => !open)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label="Conversation options"
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-card-border bg-background text-foreground transition-colors hover:border-accent/40 hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <MoreIcon />
      </button>
      {menuOpen ? (
        <div
          role="menu"
          aria-label="Conversation options"
          className="absolute right-0 z-50 mt-2 w-48 overflow-hidden rounded-2xl border border-card-border bg-card p-1 shadow-[0_12px_32px_rgba(20,20,20,0.16)]"
        >
          <button
            type="button"
            role="menuitem"
            onClick={resetConversation}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-foreground transition-colors hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
          >
            <NewChatIcon />
            New chat
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={!activeSessionId && visibleMessages.length === 0}
            onClick={() => {
              setMenuOpen(false);
              setConfirmingDelete(true);
            }}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-accent transition-colors hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring disabled:opacity-50"
          >
            <TrashIcon />
            Delete chat
          </button>
        </div>
      ) : null}
    </div>
  );

  const composer = (
    <div
      className={cn(
        "border-t border-card-border bg-card",
        isPage
          ? "px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5 sm:py-4"
          : "px-3 py-3 sm:px-5 sm:py-4",
      )}
    >
      {/* On desktop the composer lines up with the centred message column. */}
      <div className={cn(isPage && "mx-auto w-full max-w-3xl")}>
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
        <form onSubmit={handleSubmit} className="flex items-end gap-2" aria-busy={sending}>
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
            className="h-12 w-12 shrink-0 rounded-full px-0 sm:h-11 sm:w-11"
          >
            <span className={sending ? "animate-spin" : undefined}>
              {sending ? <SpinnerIcon /> : <SendIcon />}
            </span>
          </Button>
        </form>
        <p className="mt-2 hidden px-1 text-[11px] text-muted sm:block">
          Enter to send · Shift + Enter for a new line
        </p>
      </div>
    </div>
  );

  const welcome = (
    <div className="flex h-full flex-col justify-end gap-5">
      <div className="flex items-end gap-2">
        <MessageAvatar config={uiConfig} />
        <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-card-border bg-card px-4 py-3 text-sm leading-6 text-foreground sm:max-w-[75%]">
          <MessageText content={uiConfig.welcomeMessage} />
        </div>
      </div>
      {uiConfig.suggestedQuestions.length > 0 ? (
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
      ) : null}
    </div>
  );

  const thread = (
    <div
      ref={listRef}
      className={cn(
        "overflow-y-auto overscroll-contain bg-background px-4 py-5 sm:px-6",
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
      {showSkeleton ? (
        <HistorySkeleton />
      ) : historyError && visibleMessages.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="text-sm text-muted" role="alert">
            {historyError}
          </p>
          <button
            type="button"
            onClick={() => {
              // The restore effect owns the fetch: flipping back to "loading"
              // is all that is needed to retry it.
              setHistoryError(null);
              setRestoreState("loading");
            }}
            className="rounded-full border border-card-border bg-card px-4 py-2 text-xs font-medium text-foreground transition-colors hover:border-accent/40"
          >
            Try again
          </button>
        </div>
      ) : showEmpty ? (
        welcome
      ) : (
        <div className={cn("flex flex-col gap-3", isPage && "mx-auto w-full max-w-3xl")}>
          {visibleMessages.map((message, index) => {
            const isUser = message.role === "user";
            const isLatest = index === visibleMessages.length - 1;
            const isStreamingDraft =
              sending && isLatest && !isUser && message.content.length === 0 && !streaming;

            if (isUser) {
              return (
                <div
                  key={message.id}
                  className="max-w-[85%] self-end rounded-2xl rounded-br-md bg-accent px-4 py-3 text-sm leading-6 text-accent-foreground sm:max-w-[75%]"
                >
                  <MessageText content={message.content} />
                </div>
              );
            }

            return (
              <div key={message.id} className="flex w-full flex-col gap-1">
                <div className="flex max-w-[92%] items-end gap-2 sm:max-w-[80%]">
                  <MessageAvatar config={uiConfig} />
                  <div className="rounded-2xl rounded-bl-md border border-card-border bg-card px-4 py-3 text-sm leading-6 text-foreground">
                    {isStreamingDraft ? (
                      <ThinkingIndicator />
                    ) : (
                      <MessageText
                        content={message.content}
                        showCursor={sending && isLatest && streaming}
                      />
                    )}
                  </div>
                </div>
                {message.cta ? <MessageCta cta={message.cta} /> : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const deleteDialog = confirmingDelete ? (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/40 p-4"
      role="presentation"
      onClick={() => {
        if (!deleting) {
          setConfirmingDelete(false);
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${formId}-delete-title`}
        className="w-full max-w-sm rounded-3xl border border-card-border bg-card p-5 shadow-[0_20px_48px_rgba(20,20,20,0.24)]"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id={`${formId}-delete-title`} className="font-display text-lg tracking-tight">
          Delete this conversation?
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          This clears the chat from this page and closes it with the assistant. It cannot be
          undone.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={() => setConfirmingDelete(false)}
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={() => void confirmDeleteConversation()}
            disabled={deleting}
            className="h-11 px-5"
          >
            {deleting ? "Deleting…" : "Delete"}
          </Button>
        </div>
      </div>
    </div>
  ) : null;

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
        {/* Minimal header: back icon, Dify's avatar and Dify's name only. */}
        <header className="flex items-center gap-3 border-b border-card-border bg-card px-3 py-2.5 sm:px-4">
          <Link
            href={backHref}
            aria-label={`${backLabel} to the site`}
            title={backLabel}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-card-border bg-background text-lg text-foreground transition-colors hover:border-accent/40 hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <span aria-hidden>&larr;</span>
          </Link>
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-card-border bg-accent-soft text-accent">
            <AssistantAvatar avatar={uiConfig.avatar} avatarType={uiConfig.avatarType} />
          </span>
          <h1
            id={`${formId}-title`}
            className={cn(
              "font-display min-w-0 flex-1 truncate text-base tracking-tight sm:text-lg",
              !uiConfig.themeColor && "text-foreground",
            )}
            style={uiConfig.themeColor ? { color: uiConfig.themeColor } : undefined}
          >
            {uiConfig.name}
          </h1>
          {headerMenu}
        </header>
        {thread}
        {composer}
        {deleteDialog}
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
        <div className="min-w-0 flex-1">
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
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted">{description}</p>
          ) : null}
        </div>
        {headerMenu}
      </div>
      {thread}
      {composer}
      {deleteDialog}
    </section>
  );
}
