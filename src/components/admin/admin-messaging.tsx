"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/**
 * Shared Admin messaging state (badge + unobtrusive realtime toasts).
 *
 * Mounted ONCE in the Admin layout, so it survives navigation between Admin
 * pages: one Realtime subscription for the whole session, one unread count,
 * no duplicate listeners per page. Only rendered inside the Admin area, which
 * is already gated by requireAdmin() / is_active_admin()-based RLS.
 *
 * Rules preserved:
 *  - The subscription only listens to INSERTs where sender_id != me. RLS
 *    (is_active_admin()) restricts what an admin can ever receive.
 *  - Showing a toast NEVER marks anything read. Messages become read via the
 *    existing mark_project_messages_read / mark_request_messages_read RPCs
 *    when the admin actually opens a conversation.
 *  - Same message is de-duplicated by id; per-conversation toasts aggregate
 *    (max two visible) instead of spamming.
 */
type AdminMessagingContextValue = {
  unreadTotal: number;
};

const AdminMessagingContext = createContext<AdminMessagingContextValue>({
  unreadTotal: 0,
});

type Toast = {
  key: string;
  chatPath: string;
  reference: string;
  title: string;
  from: string;
  latest: string;
  count: number;
};

const MAX_VISIBLE_TOASTS = 2;
const TOAST_DISMISS_MS = 8000;
const MAX_TOAST_CHARS = 120;

function preview(message: string): string {
  const singleLine = message.replace(/\s+/g, " ").trim();
  return singleLine.length > MAX_TOAST_CHARS
    ? `${singleLine.slice(0, MAX_TOAST_CHARS)}…`
    : singleLine;
}

function chatPathFor(kind: "project" | "request", id: string): string {
  return kind === "project"
    ? `/admin/projects/${id}?tab=messages`
    : `/admin/project-requests/${id}/messages`;
}

export function AdminMessagingProvider({
  userId,
  children,
}: {
  userId: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const [client] = useState<ReturnType<typeof createBrowserSupabaseClient> | null>(
    () => {
      if (!isSupabaseConfigured()) {
        return null;
      }
      try {
        return createBrowserSupabaseClient();
      } catch {
        return null;
      }
    },
  );

  const metaCacheRef = useRef<Map<string, { reference: string; title: string }>>(new Map());
  const senderNameCacheRef = useRef<Map<string, string>>(new Map());
  const seenIdsRef = useRef<Set<string>>(new Set());
  const toastTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const channelRef = useRef<{ remove: () => void } | null>(null);
  const pathnameRef = useRef(pathname);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshUnread = useCallback(async () => {
    if (!client) {
      return;
    }
    const { count, error } = await client
      .from("project_messages")
      .select("*", { count: "exact", head: true })
      .eq("is_read", false)
      .neq("sender_id", userId);
    if (!error && typeof count === "number") {
      setUnreadTotal(count);
    }
  }, [client, userId]);

  const clearToast = useCallback((key: string) => {
    setToasts((prev) => prev.filter((toast) => toast.key !== key));
    const timer = toastTimersRef.current.get(key);
    if (timer) {
      clearTimeout(timer);
      toastTimersRef.current.delete(key);
    }
  }, []);

  const pushOrMergeToast = useCallback(
    (toast: Omit<Toast, "count">) => {
      setToasts((prev) => {
        const existing = prev.find((item) => item.key === toast.key);
        const without = prev.filter((item) => item.key !== toast.key);
        if (existing || without.length < MAX_VISIBLE_TOASTS) {
          return [
            ...without,
            existing
              ? { ...existing, latest: toast.latest, count: existing.count + 1 }
              : { ...toast, count: 1 },
          ];
        }
        return prev;
      });
      const timer = toastTimersRef.current.get(toast.key);
      if (timer) {
        clearTimeout(timer);
      }
      toastTimersRef.current.set(
        toast.key,
        setTimeout(() => clearToast(toast.key), TOAST_DISMISS_MS),
      );
    },
    [clearToast],
  );

  const resolveSenderName = useCallback(
    async (senderId: string | null): Promise<string> => {
      if (!senderId || !client) {
        return "A client";
      }
      const cached = senderNameCacheRef.current.get(senderId);
      if (cached) {
        return cached;
      }
      try {
        const { data } = await client
          .from("profiles")
          .select("display_name, full_name")
          .eq("id", senderId)
          .maybeSingle();
        const name = data?.display_name || data?.full_name || "A client";
        senderNameCacheRef.current.set(senderId, name);
        return name;
      } catch {
        return "A client";
      }
    },
    [client],
  );

  const handleIncomingRow = useCallback(
    (value: unknown) => {
      if (!value || typeof value !== "object") {
        return;
      }
      const row = value as {
        id?: unknown;
        project_id?: unknown;
        request_id?: unknown;
        sender_id?: unknown;
        message?: unknown;
        created_at?: unknown;
      };
      if (typeof row.id !== "string") {
        return;
      }
      const id: string = row.id;
      if (seenIdsRef.current.has(id)) {
        return;
      }
      seenIdsRef.current.add(id);

      const hasProject = typeof row.project_id === "string" && row.project_id.length > 0;
      const hasRequest = typeof row.request_id === "string" && row.request_id.length > 0;
      const kind: "project" | "request" | null = hasProject
        ? "project"
        : hasRequest
          ? "request"
          : null;
      const contextId = hasProject
        ? (row.project_id as string)
        : hasRequest
          ? (row.request_id as string)
          : "";
      if (!kind) {
        return;
      }

      const chatPath = chatPathFor(kind, contextId);
      // Already looking at this conversation? The chat handles it.
      if (
        pathnameRef.current === chatPath ||
        (kind === "project" &&
          pathnameRef.current === `/admin/projects/${contextId}`)
      ) {
        return;
      }

      void refreshUnread();

      void (async () => {
        const cacheKey = `${kind}:${contextId}`;
        const cached = metaCacheRef.current.get(cacheKey);
        let meta = cached ?? null;
        if (!meta && client) {
          try {
            if (kind === "project") {
              const { data } = await client
                .from("projects")
                .select("project_number, title")
                .eq("id", contextId)
                .maybeSingle();
              meta = data
                ? { reference: data.project_number, title: data.title }
                : null;
            } else {
              const { data } = await client
                .from("project_requests")
                .select("request_number, project_type")
                .eq("id", contextId)
                .maybeSingle();
              meta = data
                ? {
                    reference: data.request_number,
                    title: data.project_type || "Project request",
                  }
                : null;
            }
          } catch {
            meta = null;
          }
          if (meta) {
            metaCacheRef.current.set(cacheKey, meta);
          }
        }
        if (!meta) {
          return;
        }
        const from = await resolveSenderName(
          typeof row.sender_id === "string" ? row.sender_id : null,
        );
        pushOrMergeToast({
          key: cacheKey,
          chatPath,
          reference: meta.reference,
          title: meta.title,
          from,
          latest: preview(typeof row.message === "string" ? row.message : ""),
        });
      })();
    },
    [client, pushOrMergeToast, refreshUnread, resolveSenderName],
  );

  // One subscription per admin session (the Admin layout mounts this once).
  useEffect(() => {
    if (!client) {
      return;
    }
    let active = true;
    const timers = toastTimersRef.current;
    const channel = client
      .channel(`admin-message-center:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "project_messages",
          filter: `sender_id=neq.${userId}`,
        },
        (payload) => {
          handleIncomingRow((payload as { new?: unknown }).new);
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED" && active) {
          void refreshUnread();
        }
      });
    channelRef.current = { remove: () => void client.removeChannel(channel) };

    return () => {
      active = false;
      channelRef.current?.remove();
      channelRef.current = null;
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
      timers.clear();
    };
  }, [client, userId, handleIncomingRow, refreshUnread]);

  // Keep the badge accurate across admin navigation + tab focus.
  useEffect(() => {
    pathnameRef.current = pathname;
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }
    refreshTimerRef.current = setTimeout(() => {
      void refreshUnread();
    }, 250);
  }, [pathname, refreshUnread]);

  useEffect(() => {
    const refetch = () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
      refreshTimerRef.current = setTimeout(() => {
        void refreshUnread();
      }, 250);
    };
    window.addEventListener("focus", refetch);
    document.addEventListener("visibilitychange", refetch);
    return () => {
      window.removeEventListener("focus", refetch);
      document.removeEventListener("visibilitychange", refetch);
    };
  }, [refreshUnread]);

  const contextValue = useMemo(
    () => ({ unreadTotal }),
    [unreadTotal],
  );

  return (
    <AdminMessagingContext.Provider value={contextValue}>
      {children}

      {/* Unobtrusive toasts — aggregated per conversation, never mark read. */}
      {toasts.length > 0 ? (
        <div
          className="pointer-events-none fixed right-4 bottom-4 left-4 z-[60] flex flex-col gap-2 sm:left-auto sm:w-[22rem]"
          aria-live="polite"
          aria-atomic="false"
        >
          {toasts.map((toast) => (
            <div
              key={toast.key}
              className="pointer-events-auto rounded-2xl border border-card-border bg-card p-4 shadow-lg"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs font-semibold tracking-wider text-accent uppercase">
                  {toast.count > 1 ? `${toast.count} new messages` : "New message"} ·{" "}
                  {toast.from}
                </p>
                <button
                  type="button"
                  onClick={() => clearToast(toast.key)}
                  aria-label="Dismiss notification"
                  className="-mt-1 -mr-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-accent-soft hover:text-foreground"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="mt-1 truncate text-sm font-medium text-foreground">
                {toast.reference} · {toast.title}
              </p>
              <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted">
                {toast.latest}
              </p>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    clearToast(toast.key);
                    if (pathnameRef.current !== toast.chatPath) {
                      router.push(toast.chatPath);
                    }
                  }}
                  className="inline-flex h-10 flex-1 items-center justify-center rounded-full bg-foreground px-4 text-sm font-medium text-background transition-opacity hover:opacity-90"
                >
                  View Chat
                </button>
                <button
                  type="button"
                  onClick={() => clearToast(toast.key)}
                  className="inline-flex h-10 flex-1 items-center justify-center rounded-full border border-card-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:border-foreground/25"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </AdminMessagingContext.Provider>
  );
}

export function useAdminMessaging(): AdminMessagingContextValue {
  return useContext(AdminMessagingContext);
}

/** Dashboard summary card (client-side, shares the provider's live count —
 *  no duplicate queries). */
export function AdminMessagesSummaryCard() {
  const { unreadTotal } = useAdminMessaging();
  return (
    <div className="flex h-full flex-col justify-between rounded-3xl border border-card-border bg-card p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-display text-4xl tracking-tight text-foreground">
            {unreadTotal}
          </p>
          <p className="mt-1 text-sm text-muted">
            {unreadTotal === 1 ? "unread message" : "unread messages"}
          </p>
        </div>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-accent" aria-hidden="true">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </div>
      <p className="mt-4 text-sm leading-6 text-muted">
        Messages from clients across projects and project requests. Open a
        conversation to reply — reading it marks it as seen.
      </p>
    </div>
  );
}

/** Header entry: Messages link + live unread badge. */
export function AdminMessagesNavItem() {
  const { unreadTotal } = useAdminMessaging();
  return (
    <Link
      href="/admin/messages"
      aria-label={`Messages${unreadTotal > 0 ? ` (${unreadTotal} unread)` : ""}`}
      className="relative inline-flex h-10 items-center gap-2 rounded-full border border-card-border bg-card px-3 text-xs font-semibold text-foreground transition-colors hover:border-accent/40 hover:text-accent"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
      <span className="hidden md:inline">Messages</span>
      {unreadTotal > 0 ? (
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground">
          {unreadTotal > 99 ? "99+" : unreadTotal}
        </span>
      ) : null}
    </Link>
  );
}
