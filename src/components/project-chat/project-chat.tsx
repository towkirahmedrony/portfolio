"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { cn } from "@/lib/utils";
import { notifyAdminOfClientChatMessage } from "@/lib/notify-client-chat-message";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { ProjectMessageRow } from "@/types/database";

/**
 * Shared realtime project conversation (Client <-> Admin).
 *
 * One conversation == one project, stored in the existing `project_messages`
 * table. No project/request reference from the browser is ever trusted as
 * proof of authorization: reads go through the session's RLS policies and
 * every write goes through the SECURITY DEFINER RPC `send_project_message`,
 * which resolves the sender from auth.uid() and verifies inside the database
 * that the caller owns the project or is an active admin.
 *
 * Realtime uses a single postgres_changes subscription filtered to this
 * project only; it is removed on unmount. Message ids are the canonical
 * identity, so a realtime echo of an insert performed by this same tab is
 * never rendered twice.
 */

const PAGE_SIZE = 100;
const MAX_MESSAGE_LENGTH = 2000;

type Viewer = {
  id: string;
  isAdmin: boolean;
};

type ChannelState = "connecting" | "live" | "degraded";

type ProjectChatProps = {
  projectId?: string;
  projectNumber: string;
  projectTitle: string;
  /** Owning client's profile id (used to label messages when viewing as admin). */
  clientId: string;
  /** Human-friendly client name (used when viewing as admin). */
  clientName: string;
  /** Route back to the originating project details page. */
  backHref: string;
  backLabel?: string;
  className?: string;
  /**
   * Whether this viewer may send new messages. The client chat page passes
   * false for cancelled projects (read-only history); Admin usage stays
   * enabled by default. The database RPC independently rejects client sends
   * on cancelled projects.
   */
  allowSendMessages?: boolean;
  /**
   * When provided, this renders a REQUEST-stage conversation (before a
   * Project exists) instead of a project conversation. The same
   * project_messages rows are used; when the request converts into a project,
   * the rows are relinked to the project by the database trigger and this
   * same history keeps showing in the project chat.
   */
  requestId?: string;
  /**
   * Context-aware "Details" destination: project chat -> the project's
   * details page; request chat -> the request's details page. After a request
   * converts, the request chat redirects to the project chat, so this always
   * points at the current (non-obsolete) details page.
   */
  detailsHref?: string;
  /**
   * When the server page already resolved the authenticated viewer (client
   * chat pages do), pass it here to skip the client-side auth + profile
   * round-trips — the first messages render sooner.
   */
  knownViewer?: { id: string; isAdmin: boolean } | null;
  /**
   * Dedicated Chat routes pass true so the conversation owns the viewport
   * (no surrounding page chrome). In-page embeds (e.g. the Admin project
   * Messages tab) leave this unset.
   */
  fillViewport?: boolean;
};

function asMessageRow(value: unknown): ProjectMessageRow | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const v = value as Record<string, unknown>;
  const hasProject = typeof v.project_id === "string" && v.project_id.length > 0;
  const hasRequest = typeof v.request_id === "string" && v.request_id.length > 0;
  if (typeof v.id !== "string" || (!hasProject && !hasRequest)) {
    return null;
  }
  return {
    id: v.id,
    project_id: hasProject ? (v.project_id as string) : null,
    request_id: hasRequest ? (v.request_id as string) : null,
    sender_id: typeof v.sender_id === "string" ? v.sender_id : null,
    message: typeof v.message === "string" ? v.message : "",
    reply_to_id: typeof v.reply_to_id === "string" ? v.reply_to_id : null,
    is_read: v.is_read !== false,
    read_at: typeof v.read_at === "string" ? v.read_at : null,
    created_at: typeof v.created_at === "string" ? v.created_at : "",
    updated_at: typeof v.updated_at === "string" ? v.updated_at : "",
  };
}

/** Merge rows keyed by canonical id and keep ascending created_at order. */
function mergeRows(
  current: ProjectMessageRow[],
  incoming: ProjectMessageRow[],
): ProjectMessageRow[] {
  const byId = new Map<string, ProjectMessageRow>();
  for (const row of current) {
    byId.set(row.id, row);
  }
  for (const row of incoming) {
    if (row && row.id) {
      byId.set(row.id, row);
    }
  }
  return [...byId.values()].sort((a, b) => {
    const at = a.created_at ?? "";
    const bt = b.created_at ?? "";
    if (at !== bt) {
      return at < bt ? -1 : 1;
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

function friendlyError(error: { message?: string; code?: string } | null): string {
  if (!error) {
    return "Something went wrong.";
  }
  const code = error.code ?? "";
  const message = (error.message ?? "").toLowerCase();
  if (code === "PGRST202" || message.includes("could not find the function")) {
    // The RPC (send_project_message / mark_project_messages_read /
    // send_request_message / mark_request_messages_read) is not in the
    // PostgREST schema cache — the migration has not been applied yet or the
    // schema cache has not reloaded since it was.
    return "Messaging is not set up in this database yet — apply the project_chat_realtime migration (and request_messaging_conversation_continuity for request chats), then reload the schema.";
  }
  if (code === "42703" || /column .* does not exist/.test(message)) {
    // e.g. project_messages.request_id — the request-stage messaging migration
    // (request_id column, request-scope RLS, trigger, request RPCs) is missing.
    return "Request-stage messaging is not set up in this database yet — apply the request_messaging_conversation_continuity migration, then retry.";
  }
  if (
    code === "42P01" ||
    code === "PGRST205" ||
    code === "PGRST200" ||
    message.includes("does not exist") ||
    message.includes("could not find the table") ||
    message.includes("schema cache")
  ) {
    return "Messaging is not available in the current database schema yet — apply the project_chat_realtime migration, then retry.";
  }
  if (
    code === "42501" ||
    message.includes("row-level security") ||
    message.includes("permission denied")
  ) {
    return "You do not have permission to do that on this conversation.";
  }
  return error.message ?? "Something went wrong.";
}

function dayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ProjectChat({
  projectId,
  projectNumber,
  projectTitle,
  clientId,
  clientName,
  backHref,
  backLabel = "Back to project",
  className,
  allowSendMessages = true,
  requestId,
  detailsHref,
  knownViewer,
  fillViewport = false,
}: ProjectChatProps) {
  // A conversation lives on a project OR on a project request (pre-project).
  // Both scopes share the same table, component, realtime and read-state.
  const contextColumn = requestId ? "request_id" : "project_id";
  const contextId = requestId ?? projectId ?? "";
  const [messages, setMessages] = useState<ProjectMessageRow[]>([]);
  const [viewer, setViewer] = useState<Viewer | null>(knownViewer ?? null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [initialError, setInitialError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [channelState, setChannelState] = useState<ChannelState>("connecting");
  const [showJump, setShowJump] = useState(false);
  const [loadedAll, setLoadedAll] = useState(false);
  // On mobile, the chat container is sized to the LIVE visual viewport so the
  // composer always ends exactly at the keyboard's top edge — no gap, no
  // hardcoded vh, no spacer that double-counts browser auto-pan.
  const [liveHeight, setLiveHeight] = useState<number | null>(null);

  const [client] = useState<ReturnType<typeof createBrowserSupabaseClient> | null>(() => {
    if (!isSupabaseConfigured()) {
      return null;
    }
    try {
      return createBrowserSupabaseClient();
    } catch {
      return null;
    }
  });
  const channelRef = useRef<{ remove: () => void } | null>(null);
  const messagesRef = useRef<ProjectMessageRow[]>([]);
  const viewerRef = useRef<Viewer | null>(knownViewer ?? null);
  const unreadPendingRef = useRef(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const pinnedRef = useRef(true);
  const markReadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyViewer = useCallback((next: Viewer | null) => {
    viewerRef.current = next;
    setViewer(next);
  }, []);

  const updateMessages = useCallback((rows: ProjectMessageRow[]) => {
    setMessages((prev) => {
      const next = mergeRows(prev, rows);
      messagesRef.current = next;
      return next;
    });
  }, []);

  const markIncomingRead = useCallback(() => {
    const current = viewerRef.current;
    if (!client || !current) {
      return;
    }
    if (typeof document !== "undefined" && document.visibilityState !== "visible") {
      unreadPendingRef.current = true;
      return;
    }
    if (markReadTimerRef.current) {
      clearTimeout(markReadTimerRef.current);
    }
    markReadTimerRef.current = setTimeout(() => {
      unreadPendingRef.current = false;
      void (async () => {
        try {
          const { error } = requestId
            ? await client.rpc("mark_request_messages_read", {
                p_request_id: requestId,
              })
            : await client.rpc("mark_project_messages_read", {
                p_project_id: projectId ?? "",
              });
          if (error) {
            // Read-state is best-effort; never fail the conversation for it.
            unreadPendingRef.current = true;
            console.error("mark messages read failed:", error.message);
          }
        } catch {
          unreadPendingRef.current = true;
        }
      })();
    }, 300);
  }, [client, projectId, requestId]);

  const scrollToBottom = useCallback(() => {
    const el = listRef.current;
    if (!el) {
      return;
    }
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, []);

  const handleScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) {
      return;
    }
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 96;
    pinnedRef.current = nearBottom;
    if (nearBottom) {
      setShowJump(false);
    }
  }, []);

  /** Load the most recent page of the conversation. */
  const loadLatest = useCallback(async () => {
    if (!client) {
      return;
    }
    setInitialLoading(true);
    setInitialError(null);
    const { data, error } = await client
      .from("project_messages")
      .select("*")
      .eq(contextColumn, contextId)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);

    if (error) {
      setInitialError(friendlyError(error));
      setInitialLoading(false);
      return;
    }
    const rows = ((data ?? []) as ProjectMessageRow[]).slice().reverse();
    updateMessages(rows);
    if ((data?.length ?? 0) < PAGE_SIZE) {
      setLoadedAll(true);
    }
    setInitialLoading(false);
    pinnedRef.current = true;
    scrollToBottom();
    markIncomingRead();
  }, [client, contextColumn, contextId, updateMessages, scrollToBottom, markIncomingRead]);

  /** Load messages older than the earliest one currently in state. */
  const loadOlder = useCallback(async () => {
    const current = messagesRef.current;
    if (!client || loadingOlder || loadedAll) {
      return;
    }
    const earliest = current[0];
    if (!earliest) {
      setLoadedAll(true);
      return;
    }
    setLoadingOlder(true);
    setLoadError(null);
    const { data, error } = await client
      .from("project_messages")
      .select("*")
      .eq(contextColumn, contextId)
      .lt("created_at", earliest.created_at)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);

    if (error) {
      setLoadError(friendlyError(error));
      setLoadingOlder(false);
      return;
    }
    const rows = ((data ?? []) as ProjectMessageRow[]).slice().reverse();
    updateMessages(rows);
    if ((data?.length ?? 0) < PAGE_SIZE) {
      setLoadedAll(true);
    }
    setLoadingOlder(false);
  }, [client, contextColumn, contextId, updateMessages, loadingOlder, loadedAll]);

  const handleIncomingRow = useCallback(
    (value: unknown) => {
      const row = asMessageRow(value);
      if (!row) {
        return;
      }
      let added = false;
      setMessages((prev) => {
        const already = prev.some((existing) => existing.id === row.id);
        added = !already;
        if (already) {
          return prev;
        }
        const next = mergeRows(prev, [row]);
        messagesRef.current = next;
        return next;
      });
      const current = viewerRef.current;
      if (added && current && row.sender_id !== current.id) {
        unreadPendingRef.current = true;
        markIncomingRead();
        if (!pinnedRef.current) {
          setShowJump(true);
        }
      }
    },
    [markIncomingRead],
  );

  const send = useCallback(async () => {
    const currentViewer = viewerRef.current;
    const body = draft.trim();
    if (!client || !currentViewer || sending || !body || !allowSendMessages) {
      return;
    }
    if (body.length > MAX_MESSAGE_LENGTH) {
      setSendError(`Messages are limited to ${MAX_MESSAGE_LENGTH} characters.`);
      return;
    }
    setSending(true);
    setSendError(null);
    try {
      const { data, error } = requestId
        ? await client.rpc("send_request_message", {
            p_request_id: requestId,
            p_message: body,
          })
        : await client.rpc("send_project_message", {
            p_project_id: projectId ?? "",
            p_message: body,
          });
      if (error) {
        setSendError(friendlyError(error));
        return;
      }
      const row = asMessageRow(data);
      const storedId =
        row?.id ??
        (data && typeof data === "object" && typeof (data as { id?: unknown }).id === "string"
          ? (data as { id: string }).id
          : null);
      if (!currentViewer.isAdmin && storedId) {
        void notifyAdminOfClientChatMessage(storedId);
      }
      if (!row) {
        // Stored (the RPC succeeded) but the payload shape was unexpected —
        // reconcile from the database instead of losing the message.
        setDraft("");
        pinnedRef.current = true;
        await loadLatest();
        return;
      }
      updateMessages([row]);
      setDraft("");
      pinnedRef.current = true;
      setShowJump(false);
      scrollToBottom();
    } catch (caught) {
      setSendError(caught instanceof Error ? caught.message : "Could not send the message.");
    } finally {
      setSending(false);
    }
  }, [client, draft, sending, projectId, requestId, allowSendMessages, updateMessages, scrollToBottom, loadLatest]);

  const handleSubmit = useCallback(
    (event: FormEvent) => {
      event.preventDefault();
      void send();
    },
    [send],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
        event.preventDefault();
        void send();
      }
    },
    [send],
  );

  // ------------------------------------------------------------------
  // Bootstrap: resolve the viewer, load history, then open realtime.
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!client) {
      // Rendered as a configuration error below; nothing to bootstrap.
      return;
    }
    let active = true;
    const topic = requestId
      ? `request-chat:${requestId}`
      : `project-chat:${projectId}`;

    void (async () => {
      if (!knownViewer) {
        // Fallback path (e.g. embedded admin views): resolve the session and
        // the profile role on the client.
        const {
          data: { user },
        } = await client.auth.getUser();
        if (!active) {
          return;
        }
        if (!user) {
          setInitialError("Sign in to view this conversation.");
          setInitialLoading(false);
          return;
        }

        const { data: profile } = await client
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();
        if (!active) {
          return;
        }
        applyViewer({ id: user.id, isAdmin: profile?.role === "admin" });
        await loadLatest();
        if (!active) {
          return;
        }
      } else {
        // The server page already authenticated this viewer — render history
        // immediately, then open realtime. No extra auth/profile round-trips.
        applyViewer(knownViewer);
        await loadLatest();
        if (!active) {
          return;
        }
      }

      // Single subscription filtered to this conversation. Cleaned up on
      // unmount. Request-scoped rows are relinked to the project by the DB
      // when the request converts; this filter automatically follows the row.
      const channel = client
        .channel(topic)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "project_messages",
            filter: `${contextColumn}=eq.${contextId}`,
          },
          (payload) => {
            handleIncomingRow((payload as { new?: unknown }).new);
          },
        )
        .subscribe((status) => {
          if (!active) {
            return;
          }
          if (status === "SUBSCRIBED") {
            setChannelState("live");
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            // Supabase realtime reconnects automatically; keep the UI usable
            // and surface that live updates are paused.
            setChannelState("degraded");
          } else {
            setChannelState("connecting");
          }
        });
      channelRef.current = { remove: () => void client.removeChannel(channel) };
    })();

    const visibilityHandler = () => {
      if (document.visibilityState === "visible" && unreadPendingRef.current) {
        markIncomingRead();
      }
    };
    document.addEventListener("visibilitychange", visibilityHandler);

    return () => {
      active = false;
      document.removeEventListener("visibilitychange", visibilityHandler);
      if (markReadTimerRef.current) {
        clearTimeout(markReadTimerRef.current);
      }
      channelRef.current?.remove();
      channelRef.current = null;
    };
  }, [client, projectId, requestId, knownViewer, contextColumn, contextId, loadLatest, applyViewer, handleIncomingRow, markIncomingRead]);

  // Keep the list pinned to the newest message unless the user scrolled up.
  useEffect(() => {
    if (pinnedRef.current && messages.length > 0) {
      scrollToBottom();
    }
  }, [messages.length, scrollToBottom]);

  // Mobile: size the chat to the live visual viewport. When the keyboard
  // opens, the visual viewport shrinks by exactly the keyboard's height, so
  // the composer's bottom edge lands precisely on the keyboard's top edge —
  // no blank space in between, and no fixed-vh traps.
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) {
      return;
    }
    const update = () => {
      if (window.innerWidth >= 640) {
        setLiveHeight(null);
        return;
      }
      // Dedicated Chat routes sit flush with the viewport; client profile
      // chat still sits below the public navbar (~68px).
      const topOffset = fillViewport ? 0 : 68;
      const height = Math.max(0, Math.round(viewport.height - topOffset));
      setLiveHeight((prev) => (prev === height ? prev : height));
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
  }, [fillViewport]);

  useEffect(() => {
    if (liveHeight !== null) {
      scrollToBottom();
    }
  }, [liveHeight, scrollToBottom]);

  // Auto-resize the composer textarea (bounded).
  const handleDraftChange = useCallback((value: string) => {
    setDraft(value);
    setSendError(null);
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 168)}px`;
    }
  }, []);

  const canSend =
    Boolean(viewer) &&
    !sending &&
    draft.trim().length > 0 &&
    draft.trim().length <= MAX_MESSAGE_LENGTH;

  const channelPill =
    channelState === "live" ? null : channelState === "degraded" ? (
      <span
        className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-700 dark:text-amber-400"
        title="Live updates paused — reconnecting automatically."
      >
        <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-amber-500" />
        <span className="hidden sm:inline">Reconnecting…</span>
      </span>
    ) : (
      <span
        className="inline-flex items-center gap-1.5 rounded-full border border-card-border bg-card px-2.5 py-1 text-[11px] font-medium text-muted"
        title="Connecting to live updates."
      >
        <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-muted" />
        <span className="hidden sm:inline">Connecting…</span>
      </span>
    );

  return (
    <section
      className={cn(
        "relative flex min-h-0 w-full flex-col overflow-hidden bg-card",
        fillViewport
          ? "h-full min-h-0 flex-1 rounded-none border-0 shadow-none"
          : "rounded-2xl border border-card-border shadow-[0_1px_0_rgba(20,20,20,0.04)] sm:rounded-3xl",
        className,
      )}
      style={liveHeight !== null ? { height: liveHeight } : undefined}
      aria-label={`Messages for ${projectNumber}`}
    >
      {/* Header — project context is always visible here. */}
      <div
        className={cn(
          "flex items-center gap-3 border-b border-card-border bg-card px-3 sm:px-4",
          fillViewport ? "py-2.5" : "py-3",
        )}
      >
        <Link
          href={backHref}
          aria-label={`${backLabel} — ${projectNumber}`}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-card-border bg-background text-base text-foreground transition-colors hover:border-accent/40 hover:text-accent sm:w-auto sm:gap-1.5 sm:px-3 sm:text-xs"
        >
          <span aria-hidden>&larr;</span>
          <span className="hidden sm:inline">{backLabel}</span>
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-semibold tracking-wider text-accent uppercase">
            {projectNumber}
          </p>
          <h2 className="truncate font-display text-sm font-medium tracking-tight text-foreground sm:text-base">
            {viewer?.isAdmin || knownViewer?.isAdmin
              ? clientName || "Client"
              : projectTitle}
          </h2>
        </div>
        {detailsHref ? (
          <Link
            href={detailsHref}
            aria-label={`Open details for ${projectNumber}`}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-card-border bg-background px-3.5 text-xs font-semibold text-foreground transition-colors hover:border-accent/40 hover:text-accent sm:px-4"
          >
            Details
            <span aria-hidden>&rarr;</span>
          </Link>
        ) : null}
        <div className="shrink-0">{channelPill}</div>
      </div>

      {/* Message list */}
      <div
        ref={listRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overscroll-contain bg-background/60 px-3 py-4 sm:px-5"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
      >
        {!client ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
            <p className="text-sm text-muted" role="alert">
              Chat is unavailable because Supabase is not configured.
            </p>
          </div>
        ) : initialLoading ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted">Loading conversation…</p>
          </div>
        ) : initialError ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
            <p className="text-sm text-muted" role="alert">
              {initialError}
            </p>
            {!initialError.includes("Sign in") ? (
              <button
                type="button"
                onClick={() => void loadLatest()}
                className="rounded-full border border-card-border bg-card px-4 py-2 text-xs font-medium text-foreground transition-colors hover:border-accent/40"
              >
                Try again
              </button>
            ) : null}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
            <p className="text-sm font-medium text-foreground">No messages yet</p>
            <p className="max-w-xs text-xs leading-5 text-muted">
              {allowSendMessages
                ? `This conversation is attached to ${projectNumber}. Messages you send appear instantly for the other side.`
                : `This project was cancelled before any messages were exchanged, so new messages can't be sent.`}
            </p>
          </div>
        ) : (
          <>
            <div className="mb-3 flex flex-col items-center gap-1">
              {!loadedAll ? (
                <button
                  type="button"
                  onClick={() => void loadOlder()}
                  disabled={loadingOlder}
                  className="rounded-full border border-card-border bg-card px-3 py-1.5 text-[11px] font-medium text-muted transition-colors hover:text-foreground disabled:opacity-60"
                >
                  {loadingOlder ? "Loading…" : "Load earlier messages"}
                </button>
              ) : null}
              {loadError ? (
                <p className="text-center text-[11px] text-red-600" role="alert">
                  {loadError}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2.5">
              {messages.map((message, index) => {
                const previous = index > 0 ? messages[index - 1] : null;
                const isMine = viewer?.id != null && message.sender_id === viewer.id;
                const isFromClient = message.sender_id === clientId;
                const showDay = !previous || dayLabel(message.created_at) !== dayLabel(previous.created_at);
                const senderChanged = previous?.sender_id !== message.sender_id;
                const showSenderName =
                  !isMine && (message.sender_id === null || senderChanged);

                const replyTarget = message.reply_to_id
                  ? (messages.find((m) => m.id === message.reply_to_id) ?? null)
                  : null;

                return (
                  <div key={message.id} className="flex flex-col">
                    {showDay ? (
                      <p className="my-2 text-center text-[11px] font-medium text-muted">
                        {dayLabel(message.created_at)}
                      </p>
                    ) : null}
                    {!isMine && showSenderName ? (
                      <p className="mb-1 px-1 text-[11px] font-medium text-muted">
                        {isFromClient ? clientName || "Client" : "Admin"}
                      </p>
                    ) : null}
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[15px] leading-6 sm:max-w-[70%] sm:text-sm",
                        isMine
                          ? "self-end rounded-br-md bg-accent text-accent-foreground"
                          : "self-start rounded-bl-md border border-card-border bg-background text-foreground",
                      )}
                    >
                      {replyTarget ? (
                        <p
                          className={cn(
                            "mb-1.5 border-l-2 pl-2 text-[11px] leading-4 line-clamp-2",
                            isMine
                              ? "border-accent-foreground/40 text-accent-foreground/80"
                              : "border-card-border text-muted",
                          )}
                        >
                          Replying to: {replyTarget.message}
                        </p>
                      ) : null}
                      <p className="whitespace-pre-line break-words">{message.message}</p>
                      <p
                        className={cn(
                          "mt-1 text-right text-[10px] tabular-nums",
                          isMine ? "text-accent-foreground/70" : "text-muted",
                        )}
                      >
                        {timeLabel(message.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-card-border bg-card px-2.5 py-2.5 sm:px-4 sm:py-3">
        {!allowSendMessages ? (
          <div className="flex items-center gap-3 px-2 py-2">
            <span className="text-sm text-muted" role="status">
              This project was cancelled — new messages can&apos;t be sent. The
              history above remains available.
            </span>
          </div>
        ) : (
          <>
            {sendError ? (
              <p className="mb-2 px-2 text-xs text-red-600" role="alert">
                {sendError}
              </p>
            ) : null}
            <form onSubmit={handleSubmit} className="flex items-end gap-2">
              <textarea
                ref={textareaRef}
                value={draft}
                onChange={(event) => handleDraftChange(event.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                maxLength={MAX_MESSAGE_LENGTH}
                disabled={!viewer || sending}
                placeholder={
                  viewer ? "Write a message… (Enter to send)" : "Sign in to send a message…"
                }
                aria-label="Message"
                className="min-h-12 w-full resize-none rounded-2xl border border-card-border bg-background px-4 py-3 text-base text-foreground outline-none transition-colors placeholder:text-muted focus:border-accent/50 disabled:opacity-60 sm:min-h-11 sm:py-2.5 sm:text-sm"
              />
              <button
                type="submit"
                disabled={!canSend}
                aria-label={sending ? "Sending message" : "Send message"}
                className="inline-flex h-12 shrink-0 items-center justify-center rounded-full bg-foreground px-6 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-40 sm:h-11 sm:px-5"
              >
                {sending ? "Sending…" : "Send"}
              </button>
            </form>
            <p className="mt-1.5 hidden px-1 text-[11px] text-muted sm:block">
              Shift + Enter for a new line · {draft.length}/{MAX_MESSAGE_LENGTH}
            </p>
          </>
        )}
      </div>

      {/* Jump to newest when scrolled up and a new message arrives */}
      {showJump ? (
        <button
          type="button"
          onClick={() => {
            pinnedRef.current = true;
            setShowJump(false);
            scrollToBottom();
          }}
          className="absolute right-4 bottom-28 z-10 rounded-full border border-card-border bg-card px-3 py-1.5 text-xs font-medium text-accent shadow-md transition-colors hover:border-accent/40"
        >
          New messages ↓
        </button>
      ) : null}
    </section>
  );
}
