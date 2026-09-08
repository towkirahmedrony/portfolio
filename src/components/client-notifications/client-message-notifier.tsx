"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/**
 * Client new-message notifier (invisible by design).
 *
 * Renders NO header icons, navigation items or badges — the public portfolio
 * header stays clean. It only exists to surface ONE centered modal when an
 * Admin sends a new message while the signed-in Client is anywhere on the
 * site. The message may belong to a project OR to a project request
 * (pre-project stage) — both live in the same project_messages table, so both
 * are handled identically here.
 *
 * Request -> Project continuity: when a request converts, its message rows
 * are relinked to the project by the database. A request-scoped modal that
 * was already shown points at the request chat page, which redirects to the
 * project chat once the project exists — so "Open Chat" always resolves to
 * the one continuous conversation.
 *
 * Showing the modal never marks anything read; read state changes only when
 * the client opens the conversation (existing RPCs). The database is the
 * source of truth — before showing, unread is re-checked.
 */

type PendingProject = {
  key: string;
  chatPath: string;
  number: string;
  title: string;
  count: number;
  latest: string;
  latestAt: string;
};

type ModalView =
  | { kind: "single"; data: PendingProject }
  | { kind: "multi"; total: number; projectCount: number; names: string[] };

type Meta = {
  number: string;
  title: string;
  chatPath: string;
};

function preview(message: string): string {
  const singleLine = message.replace(/\s+/g, " ").trim();
  return singleLine.length > 160 ? `${singleLine.slice(0, 160)}…` : singleLine;
}

type RawRow = {
  id: string;
  contextKind: "project" | "request";
  contextId: string;
  message: string;
  createdAt: string;
};

export function ClientMessageNotifier() {
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

  const [active, setActive] = useState(false); // signed-in client only
  const [modal, setModal] = useState<ModalView | null>(null);

  const viewerIdRef = useRef<string | null>(null);
  const pathnameRef = useRef(pathname);
  const metaCacheRef = useRef<Map<string, Meta>>(new Map());
  const seenIdsRef = useRef<Set<string>>(new Set());
  const pendingRef = useRef<Map<string, PendingProject>>(new Map());
  const queuedRowsRef = useRef<RawRow[]>([]);
  const modalOpenRef = useRef(false);
  const openingRef = useRef(false);
  const channelRef = useRef<{ remove: () => void } | null>(null);

  const chatPathFor = useCallback((kind: "project" | "request", id: string) => {
    return kind === "project"
      ? `/profile/projects/${id}/messages`
      : `/profile/project-requests/${id}/messages`;
  }, []);

  const dismissAll = useCallback(() => {
    modalOpenRef.current = false;
    pendingRef.current.clear();
    setModal(null);
  }, []);

  const snapshotFromPending = useCallback((): ModalView | null => {
    const values = [...pendingRef.current.values()].sort((a, b) =>
      a.latestAt < b.latestAt ? 1 : -1,
    );
    if (values.length === 0) {
      return null;
    }
    if (values.length === 1) {
      return { kind: "single", data: values[0] };
    }
    return {
      kind: "multi",
      total: values.reduce((sum, project) => sum + project.count, 0),
      projectCount: values.length,
      names: values.slice(0, 3).map((project) => project.title),
    };
  }, []);

  const openOrMergeModal = useCallback(() => {
    const snapshot = snapshotFromPending();
    if (!snapshot) {
      return;
    }
    modalOpenRef.current = true;
    setModal(snapshot);
  }, [snapshotFromPending]);

  const countUnread = useCallback(async (): Promise<number> => {
    const currentId = viewerIdRef.current;
    if (!currentId || !client) {
      return 0;
    }
    const { count, error } = await client
      .from("project_messages")
      .select("*", { count: "exact", head: true })
      .eq("is_read", false)
      .neq("sender_id", currentId);
    return !error && typeof count === "number" ? count : 0;
  }, [client]);

  const attemptOpenModal = useCallback(async () => {
    if (openingRef.current || modalOpenRef.current) {
      return;
    }
    openingRef.current = true;
    try {
      // The database is the source of truth — never show a modal for messages
      // that were already read somewhere else.
      const unread = await countUnread();
      if (unread > 0 && snapshotFromPending()) {
        openOrMergeModal();
      } else {
        pendingRef.current.clear();
      }
    } finally {
      openingRef.current = false;
    }
  }, [countUnread, openOrMergeModal, snapshotFromPending]);

  const processRow = useCallback(
    async (row: RawRow) => {
      const currentId = viewerIdRef.current;
      if (!currentId) {
        return;
      }
      const chatPath = chatPathFor(row.contextKind, row.contextId);
      // Currently reading this exact conversation — the chat owns the thread
      // there and will mark the message read. No modal.
      if (pathnameRef.current === chatPath) {
        return;
      }

      const cacheKey = `${row.contextKind}:${row.contextId}`;
      let meta: Meta | null = metaCacheRef.current.get(cacheKey) ?? null;
      if (!meta && client) {
        try {
          if (row.contextKind === "project") {
            const { data } = await client
              .from("projects")
              .select("project_number, title")
              .eq("id", row.contextId)
              .maybeSingle();
            meta = data
              ? {
                  number: data.project_number,
                  title: data.title,
                  chatPath,
                }
              : null;
          } else {
            const { data } = await client
              .from("project_requests")
              .select("request_number, project_type")
              .eq("id", row.contextId)
              .maybeSingle();
            meta = data
              ? {
                  number: data.request_number,
                  title: data.project_type || "Project request",
                  chatPath,
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
        // No access / no such conversation — RLS already hid the row.
        return;
      }

      const existing = pendingRef.current.get(cacheKey);
      if (existing) {
        existing.count += 1;
        existing.latest = preview(row.message);
        existing.latestAt = row.createdAt;
      } else {
        pendingRef.current.set(cacheKey, {
          key: cacheKey,
          chatPath,
          number: meta.number,
          title: meta.title,
          count: 1,
          latest: preview(row.message),
          latestAt: row.createdAt,
        });
      }

      if (modalOpenRef.current) {
        // Merge into the open modal (aggregation, never stacking).
        openOrMergeModal();
        return;
      }
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        // Wait until the client returns to the tab, then show once.
        return;
      }
      void attemptOpenModal();
    },
    [client, chatPathFor, openOrMergeModal, attemptOpenModal],
  );

  const flushQueued = useCallback(() => {
    const queued = queuedRowsRef.current;
    queuedRowsRef.current = [];
    for (const row of queued) {
      void processRow(row);
    }
  }, [processRow]);

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
      const currentId = viewerIdRef.current;
      if (!currentId || row.sender_id === currentId || seenIdsRef.current.has(id)) {
        return;
      }
      seenIdsRef.current.add(id);

      const hasProject = typeof row.project_id === "string" && row.project_id.length > 0;
      const hasRequest = typeof row.request_id === "string" && row.request_id.length > 0;
      const contextKind = hasProject ? "project" : hasRequest ? "request" : null;
      const contextId = hasProject ? (row.project_id as string) : hasRequest ? (row.request_id as string) : "";
      if (!contextKind) {
        return;
      }

      const raw: RawRow = {
        id,
        contextKind,
        contextId,
        message: typeof row.message === "string" ? row.message : "",
        createdAt: typeof row.created_at === "string" ? row.created_at : "",
      };
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        queuedRowsRef.current.push(raw);
        return;
      }
      void processRow(raw);
    },
    [processRow],
  );

  // ------------------------------------------------------------------
  // Auth gate + single realtime subscription (RLS-scoped).
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!client) {
      return;
    }
    let active = true;
    const queued = queuedRowsRef.current;
    const pending = pendingRef.current;

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
        setActive(false);
        return;
      }
      viewerIdRef.current = user.id;
      setActive(true);

      // One subscription for the whole project_messages table. RLS decides
      // which rows may reach this client (own projects + own requests).
      const channel = client
        .channel(`client-message-notifier:${user.id}`)
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
        .subscribe();
      channelRef.current = { remove: () => void client.removeChannel(channel) };
    })();

    return () => {
      active = false;
      channelRef.current?.remove();
      channelRef.current = null;
      queued.length = 0;
      pending.clear();
      modalOpenRef.current = false;
    };
  }, [client, handleIncomingRow]);

  // Track the current route (modal must not pop while reading that chat).
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  // Show a modal queued while the tab was hidden, once the client returns.
  useEffect(() => {
    if (!active) {
      return;
    }
    const onVisibility = () => {
      if (document.visibilityState !== "visible") {
        return;
      }
      if (queuedRowsRef.current.length > 0) {
        flushQueued();
      } else if (pendingRef.current.size > 0 && !modalOpenRef.current) {
        void attemptOpenModal();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [active, flushQueued, attemptOpenModal]);

  const handleOpenChat = useCallback(() => {
    const snapshot = modal;
    modalOpenRef.current = false;
    pendingRef.current.clear();
    setModal(null);
    if (!snapshot) {
      return;
    }
    if (snapshot.kind === "single") {
      router.push(snapshot.data.chatPath);
    } else {
      // Several conversations have new messages — the Messages hub lists all.
      router.push("/profile/messages");
    }
  }, [modal, router]);

  if (!active) {
    return null;
  }

  return modal ? (
    <Modal
      align="center"
      title={
        modal.kind === "single"
          ? modal.data.count > 1
            ? `You have ${modal.data.count} new messages`
            : "New message"
          : `You have ${modal.total} new messages`
      }
      description={
        modal.kind === "single"
          ? "Admin sent you a new message regarding:"
          : `New messages from the team across ${modal.projectCount} ${
              modal.projectCount === 1 ? "conversation" : "conversations"
            }.`
      }
      onClose={() => dismissAll()}
    >
      {modal.kind === "single" ? (
        <>
          <p className="text-xs font-semibold tracking-wider text-accent uppercase">
            {modal.data.number} · {modal.data.title}
          </p>
          <p className="mt-3 rounded-2xl border border-card-border bg-background px-4 py-3 text-sm leading-6 text-foreground whitespace-pre-line">
            {modal.data.latest}
          </p>
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => dismissAll()}
              className="inline-flex h-11 flex-1 items-center justify-center rounded-full border border-card-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:border-foreground/25"
            >
              Later
            </button>
            <button
              type="button"
              onClick={handleOpenChat}
              className="inline-flex h-11 flex-1 items-center justify-center rounded-full bg-foreground px-4 text-sm font-medium text-background transition-opacity hover:opacity-90"
            >
              Open Chat
            </button>
          </div>
        </>
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {modal.names.map((name) => (
              <li
                key={name}
                className="rounded-2xl border border-card-border bg-background px-4 py-3 text-sm font-medium text-foreground"
              >
                {name}
              </li>
            ))}
          </ul>
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => dismissAll()}
              className="inline-flex h-11 flex-1 items-center justify-center rounded-full border border-card-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:border-foreground/25"
            >
              Later
            </button>
            <button
              type="button"
              onClick={handleOpenChat}
              className="inline-flex h-11 flex-1 items-center justify-center rounded-full bg-foreground px-4 text-sm font-medium text-background transition-opacity hover:opacity-90"
            >
              Open Chat
            </button>
          </div>
        </>
      )}
    </Modal>
  ) : null;
}
