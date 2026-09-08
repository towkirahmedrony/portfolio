"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

/**
 * Client-side message notifications (Client <-> Admin project chat).
 *
 * Architecture (reused, no new tables / no `notifications` rows):
 *  - The single conversation store is `project_messages`; realtime INSERT
 *    events on it are the transient in-app notification source (this app has
 *    no wired `notifications` table — see the project chat migration notes).
 *  - RLS (clients see only their own projects' messages) scopes every read
 *    and every realtime event — a client can never see or be notified about
 *    another client's project.
 *  - Showing a notification NEVER marks anything read. Messages become read
 *    only when the client opens the conversation (ProjectChat -> the
 *    mark_project_messages_read RPC), which is the existing read-state
 *    architecture.
 *
 * Surfaces:
 *  1. Bell button + unread badge (persistent, every page while signed in).
 *  2. Inbox panel: unread conversations grouped by project -> opens the
 *     correct project chat.
 *  3. Aggregated toast(s) when an Admin message arrives while the app is open
 *     (per-project merge, max 2 visible to avoid spam; "Open Chat" / "Later").
 *
 * The database stays the source of truth: the unread count is re-fetched on
 * mount, route change, window focus, visibility change, reconnect, and after
 * each realtime event.
 */

type ToastState = {
  key: string;
  projectId: string;
  projectNumber: string;
  projectTitle: string;
  count: number;
  latest: string;
};
type InboxRow = {
  projectId: string;
  projectNumber: string;
  projectTitle: string;
  latest: string;
  latestAt: string;
  unread: number;
};

const MAX_VISIBLE_TOASTS = 2;
const TOAST_DISMISS_MS = 10_000;
const MAX_INBOX_MESSAGES = 60;

function preview(message: string): string {
  const singleLine = message.replace(/\s+/g, " ").trim();
  return singleLine.length > 140 ? `${singleLine.slice(0, 140)}…` : singleLine;
}

function relativeTime(iso: string): string {
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) {
    return "Just now";
  }
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.round(hours / 24);
  if (days < 7) {
    return `${days}d ago`;
  }
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

type ProjectMeta = { project_number: string; title: string };

export function ClientMessageAlerts() {
  const router = useRouter();
  const pathname = usePathname();
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

  const [viewerId, setViewerId] = useState<string | null>(null);
  const [active, setActive] = useState(false); // authenticated client only
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [inbox, setInbox] = useState<InboxRow[] | null>(null);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [inboxError, setInboxError] = useState<string | null>(null);
  const [channelState, setChannelState] = useState<"connecting" | "live" | "degraded">(
    "connecting",
  );

  const viewerIdRef = useRef<string | null>(null);
  const pathnameRef = useRef(pathname);
  const metaCacheRef = useRef<Map<string, ProjectMeta>>(new Map());
  const seenMessageIdsRef = useRef<Set<string>>(new Set());
  const toastTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef<{ remove: () => void } | null>(null);
  const panelOpenRef = useRef(false);

  const isChatPathFor = useCallback((projectId: string) => {
    return pathnameRef.current === `/profile/projects/${projectId}/messages`;
  }, []);

  const setViewer = useCallback((id: string | null) => {
    viewerIdRef.current = id;
    setViewerId(id);
  }, []);

  const fetchUnreadTotal = useCallback(async () => {
    const currentId = viewerIdRef.current;
    const currentClient = client;
    if (!currentId || !currentClient) {
      return;
    }
    const { count, error } = await currentClient
      .from("project_messages")
      .select("*", { count: "exact", head: true })
      .eq("is_read", false)
      .neq("sender_id", currentId);
    if (!error && typeof count === "number") {
      setUnreadTotal(count);
    }
  }, [client]);

  const openChat = useCallback(
    (projectId: string) => {
      setPanelOpen(false);
      const path = `/profile/projects/${projectId}/messages`;
      if (pathnameRef.current === path) {
        return;
      }
      router.push(path);
      // The chat marks messages read on mount; correct the badge afterwards.
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
      refreshTimerRef.current = setTimeout(() => {
        void fetchUnreadTotal();
      }, 1200);
    },
    [router, fetchUnreadTotal],
  );

  const fetchInbox = useCallback(async () => {
    const currentId = viewerIdRef.current;
    const currentClient = client;
    if (!currentId || !currentClient) {
      return;
    }
    setInboxLoading(true);
    setInboxError(null);
    const { data, error } = await currentClient
      .from("project_messages")
      .select("id, project_id, sender_id, message, is_read, created_at")
      .eq("is_read", false)
      .neq("sender_id", currentId)
      .order("created_at", { ascending: false })
      .limit(MAX_INBOX_MESSAGES);

    if (error) {
      setInboxError(
        "Could not load messages right now. This is usually a temporary issue — try again.",
      );
      setInbox([]);
      setInboxLoading(false);
      return;
    }

    const messages = (data ?? []) as Array<{
      project_id: string;
      message: string;
      created_at: string;
    }>;
    const projectIds = [...new Set(messages.map((row) => row.project_id))];
    const projectMeta = new Map<string, ProjectMeta>();
    if (projectIds.length > 0) {
      const { data: projects } = await currentClient
        .from("projects")
        .select("id, project_number, title")
        .in("id", projectIds);
      for (const project of projects ?? []) {
        projectMeta.set(project.id, {
          project_number: project.project_number,
          title: project.title,
        });
        metaCacheRef.current.set(project.id, {
          project_number: project.project_number,
          title: project.title,
        });
      }
    }

    const groups = new Map<string, InboxRow>();
    for (const message of messages) {
      const meta = projectMeta.get(message.project_id);
      if (!meta) {
        continue;
      }
      const existing = groups.get(message.project_id);
      if (existing) {
        existing.unread += 1;
      } else {
        // Messages arrive newest-first, so the first row per project is latest.
        groups.set(message.project_id, {
          projectId: message.project_id,
          projectNumber: meta.project_number,
          projectTitle: meta.title,
          latest: preview(message.message),
          latestAt: message.created_at,
          unread: 1,
        });
      }
    }
    setInbox(
      [...groups.values()].sort((a, b) => (a.latestAt < b.latestAt ? 1 : -1)),
    );
    setInboxLoading(false);
  }, [client]);

  const clearToast = useCallback((key: string) => {
    setToasts((prev) => prev.filter((toast) => toast.key !== key));
    const timer = toastTimersRef.current.get(key);
    if (timer) {
      clearTimeout(timer);
      toastTimersRef.current.delete(key);
    }
  }, []);

  const pushOrMergeToast = useCallback(
    (row: {
      id: string;
      project_id: string;
      sender_id: string | null;
      message: string;
    }) => {
      if (seenMessageIdsRef.current.has(row.id)) {
        return;
      }
      seenMessageIdsRef.current.add(row.id);
      const currentId = viewerIdRef.current;
      if (!currentId || row.sender_id === currentId) {
        return;
      }
      // The client is already viewing this project's chat — ProjectChat owns
      // the thread and the read-state there. Skip the toast.
      if (isChatPathFor(row.project_id)) {
        return;
      }
      const meta = metaCacheRef.current.get(row.project_id);
      if (!meta) {
        return;
      }
      const projectKey = row.project_id;
      setToasts((prev) => {
        const existing = prev.find((toast) => toast.key === projectKey);
        const nextBody = {
          key: projectKey,
          projectId: row.project_id,
          projectNumber: meta.project_number,
          projectTitle: meta.title,
          count: existing ? existing.count + 1 : 1,
          latest: preview(row.message),
        };
        const without = prev.filter((toast) => toast.key !== projectKey);
        if (existing || without.length < MAX_VISIBLE_TOASTS) {
          return [...without, nextBody];
        }
        // Too many simultaneous conversations — keep the unread badge as the
        // signal instead of spamming toasts.
        return prev;
      });
      const timer = toastTimersRef.current.get(projectKey);
      if (timer) {
        clearTimeout(timer);
      }
      toastTimersRef.current.set(
        projectKey,
        setTimeout(() => clearToast(projectKey), TOAST_DISMISS_MS),
      );
    },
    [clearToast, isChatPathFor],
  );

  const handleIncomingRow = useCallback(
    (value: unknown) => {
      if (!value || typeof value !== "object") {
        return;
      }
      const row = value as {
        id?: unknown;
        project_id?: unknown;
        sender_id?: unknown;
        message?: unknown;
        created_at?: unknown;
      };
      if (typeof row.id !== "string" || typeof row.project_id !== "string") {
        return;
      }
      const messageId: string = row.id;
      const projectId: string = row.project_id;
      const senderId = typeof row.sender_id === "string" ? row.sender_id : null;
      const body = typeof row.message === "string" ? row.message : "";
      const currentId = viewerIdRef.current;
      if (!currentId || senderId === currentId) {
        return;
      }

      void fetchUnreadTotal();

      const meta = metaCacheRef.current.get(projectId);
      if (meta) {
        pushOrMergeToast({
          id: messageId,
          project_id: projectId,
          sender_id: senderId,
          message: body,
        });
        if (panelOpenRef.current) {
          void fetchInbox();
        }
        return;
      }
      // Resolve project context once per project, then surface the toast.
      void (async () => {
        if (!client) {
          return;
        }
        try {
          const { data } = await client
            .from("projects")
            .select("project_number, title")
            .eq("id", projectId)
            .maybeSingle();
          if (!data) {
            return;
          }
          metaCacheRef.current.set(projectId, {
            project_number: data.project_number,
            title: data.title,
          });
          pushOrMergeToast({
            id: messageId,
            project_id: projectId,
            sender_id: senderId,
            message: body,
          });
          if (panelOpenRef.current) {
            void fetchInbox();
          }
        } catch {
          // Project lookup failed (e.g. no longer accessible) — badge count
          // still reflects unread state from the database query above.
        }
      })();
    },
    [client, fetchUnreadTotal, fetchInbox, pushOrMergeToast],
  );

  // ------------------------------------------------------------------
  // Identify the signed-in client and open one realtime subscription.
  // RLS guarantees only this client's own projects' messages arrive.
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!client) {
      return;
    }
    let active = true;
    const toastTimers = toastTimersRef.current;

    void (async () => {
      const {
        data: { user },
      } = await client.auth.getUser();
      if (!active) {
        return;
      }
      if (!user) {
        setActive(false);
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
      if (profile?.role !== "client") {
        // Admins use the Admin Panel for messaging; keep the public chrome clean.
        setActive(false);
        return;
      }
      setViewer(user.id);
      setActive(true);
      await fetchUnreadTotal();

      const channel = client
        .channel(`client-message-alerts:${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "project_messages",
            filter: `sender_id=neq.${user.id}`,
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
            void fetchUnreadTotal();
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            setChannelState("degraded");
          } else {
            setChannelState("connecting");
          }
        });
      channelRef.current = { remove: () => void client.removeChannel(channel) };
    })();

    return () => {
      active = false;
      channelRef.current?.remove();
      channelRef.current = null;
      for (const timer of toastTimers.values()) {
        clearTimeout(timer);
      }
      toastTimers.clear();
    };
  }, [client, setViewer, fetchUnreadTotal, handleIncomingRow]);

  // Database remains the source of truth for the badge: refetch on route
  // change, tab focus/visibility, and reconnects.
  useEffect(() => {
    pathnameRef.current = pathname;
    if (viewerIdRef.current && client) {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
      refreshTimerRef.current = setTimeout(() => {
        void fetchUnreadTotal();
      }, 300);
    }
  }, [pathname, viewerId, client, fetchUnreadTotal]);

  useEffect(() => {
    if (!viewerIdRef.current) {
      return;
    }
    const refetch = () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
      refreshTimerRef.current = setTimeout(() => {
        void fetchUnreadTotal();
      }, 300);
    };
    window.addEventListener("focus", refetch);
    document.addEventListener("visibilitychange", refetch);
    return () => {
      window.removeEventListener("focus", refetch);
      document.removeEventListener("visibilitychange", refetch);
    };
  }, [fetchUnreadTotal, viewerId]);

  useEffect(() => {
    panelOpenRef.current = panelOpen;
    if (panelOpen && active && viewerId) {
      void fetchInbox();
    }
  }, [panelOpen, active, viewerId, fetchInbox]);

  if (!active || !viewerId) {
    return null;
  }

  return (
    <>
      <div className="relative">
        <button
          type="button"
          aria-label={`Messages${unreadTotal > 0 ? ` (${unreadTotal} unread)` : ""}`}
          aria-expanded={panelOpen}
          aria-haspopup="true"
          onClick={() => setPanelOpen((open) => !open)}
          className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-card-border bg-card text-foreground transition-colors hover:border-foreground/25 hover:bg-accent-soft"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          {unreadTotal > 0 ? (
            <span
              className="absolute -top-1 -right-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground"
              aria-hidden="true"
            >
              {unreadTotal > 99 ? "99+" : unreadTotal}
            </span>
          ) : null}
        </button>
        {channelState === "degraded" ? (
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 animate-pulse rounded-full border-2 border-background bg-amber-500"
            title="Live updates paused — reconnecting."
          />
        ) : null}

        {panelOpen ? (
          <>
            <button
              type="button"
              aria-label="Close messages panel"
              onClick={() => setPanelOpen(false)}
              className="fixed inset-0 z-40 cursor-default bg-background/40 backdrop-blur-[1px] sm:hidden"
            />
            <div
              role="dialog"
              aria-label="Unread project messages"
              className="fixed inset-x-0 bottom-0 z-50 max-h-[75dvh] overflow-hidden rounded-t-3xl border border-card-border bg-card shadow-xl sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:bottom-auto sm:mt-2 sm:w-96 sm:rounded-3xl"
            >
              <div className="flex items-center justify-between gap-3 border-b border-card-border px-4 py-3">
                <div>
                  <p className="font-display text-base font-medium tracking-tight">
                    Messages
                  </p>
                  <p className="text-xs text-muted">
                    {inboxLoading
                      ? "Loading…"
                      : unreadTotal > 0
                        ? `${unreadTotal} unread ${unreadTotal === 1 ? "message" : "messages"}`
                        : "You're all caught up"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPanelOpen(false)}
                  aria-label="Close"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-card-border bg-background text-foreground transition-colors hover:border-foreground/25"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="max-h-[calc(75dvh-7rem)] overflow-y-auto overscroll-contain p-2 sm:max-h-96">
                {inboxError ? (
                  <p className="px-3 py-6 text-center text-sm text-muted" role="alert">
                    {inboxError}
                  </p>
                ) : inboxLoading && !inbox ? (
                  <p className="px-3 py-6 text-center text-sm text-muted">
                    Loading messages…
                  </p>
                ) : !inbox || inbox.length === 0 ? (
                  <p className="px-3 py-8 text-center text-sm text-muted">
                    No new messages. When the team writes to you about a project,
                    it will appear here.
                  </p>
                ) : (
                  <ul className="divide-y divide-card-border">
                    {inbox.map((conversation) => (
                      <li key={conversation.projectId}>
                        <button
                          type="button"
                          onClick={() => openChat(conversation.projectId)}
                          className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-accent-soft"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="flex flex-wrap items-center gap-2 text-xs">
                              <span className="font-semibold tracking-wider text-accent uppercase">
                                {conversation.projectNumber}
                              </span>
                              <span className="text-muted">
                                {relativeTime(conversation.latestAt)}
                              </span>
                            </p>
                            <p className="mt-0.5 truncate text-sm font-medium text-foreground">
                              {conversation.projectTitle}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-muted">
                              {conversation.latest}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1.5">
                            {conversation.unread > 0 ? (
                              <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-bold text-accent-foreground">
                                {conversation.unread}
                              </span>
                            ) : null}
                            <span className="text-xs font-medium text-accent">
                              Open chat &rarr;
                            </span>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="border-t border-card-border p-2">
                <Link
                  href="/profile"
                  onClick={() => setPanelOpen(false)}
                  className="block rounded-xl px-3 py-2 text-center text-xs font-medium text-muted transition-colors hover:bg-accent-soft hover:text-foreground"
                >
                  View all projects
                </Link>
              </div>
            </div>
          </>
        ) : null}
      </div>

      {/* Toasts — aggregated per project, shown only for new Admin messages */}
      <div
        className="pointer-events-none fixed right-4 bottom-4 left-4 z-[60] flex flex-col gap-2 sm:left-auto sm:w-[22rem]"
        aria-live="assertive"
        aria-atomic="false"
      >
        {toasts.map((toast) => (
          <div
            key={toast.key}
            className="pointer-events-auto rounded-2xl border border-card-border bg-card p-4 shadow-lg"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-xs font-semibold tracking-wider text-accent uppercase">
                {toast.count > 1 ? `${toast.count} new messages` : "New message"} · Admin
              </p>
              <button
                type="button"
                onClick={() => clearToast(toast.key)}
                aria-label="Dismiss"
                className="-mt-1 -mr-1 inline-flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-accent-soft hover:text-foreground"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="mt-1 truncate text-sm font-medium text-foreground">
              {toast.projectNumber} · {toast.projectTitle}
            </p>
            <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted">
              {toast.latest}
            </p>
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  clearToast(toast.key);
                  openChat(toast.projectId);
                }}
                className="inline-flex h-10 flex-1 items-center justify-center rounded-full bg-foreground px-4 text-sm font-medium text-background transition-opacity hover:opacity-90"
              >
                Open Chat
              </button>
              <button
                type="button"
                onClick={() => clearToast(toast.key)}
                className="inline-flex h-10 flex-1 items-center justify-center rounded-full border border-card-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:border-foreground/25"
              >
                Later
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
