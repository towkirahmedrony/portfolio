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
 * Admin sends a new project message while the signed-in Client is anywhere on
 * the site (homepage, marketing pages, profile, project pages).
 *
 * Architecture (unchanged): realtime INSERT events on the existing
 * project_messages table are the transient alert source; RLS guarantees a
 * client only ever receives events for projects they own; showing the modal
 * never marks anything read — read state changes only when the client opens
 * the conversation (ProjectChat -> mark_project_messages_read RPC).
 *
 * Behavior:
 *  - Messages are aggregated per project into a single modal ("You have 3 new
 *    messages") — never stacked popups.
 *  - "Open Chat" -> the exact project chat (or the profile Messages page when
 *    several projects are involved); "Later"/backdrop/Escape -> modal closes,
 *    messages stay unread.
 *  - If the tab is hidden when a message arrives, the modal appears when the
 *    client returns to the tab. Before showing, the database is re-checked so
 *    messages already marked read elsewhere never trigger a misleading modal.
 */

type PendingProject = {
  projectId: string;
  number: string;
  title: string;
  count: number;
  latest: string;
  latestAt: string;
};

type ModalView =
  | { kind: "single"; data: PendingProject }
  | { kind: "multi"; total: number; projectCount: number; names: string[] };

function preview(message: string): string {
  const singleLine = message.replace(/\s+/g, " ").trim();
  return singleLine.length > 160 ? `${singleLine.slice(0, 160)}…` : singleLine;
}

type RawRow = {
  id: string;
  projectId: string;
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

  const [viewerId, setViewerId] = useState<string | null>(null);
  const [active, setActive] = useState(false); // signed-in client only
  const [modal, setModal] = useState<ModalView | null>(null);

  const viewerIdRef = useRef<string | null>(null);
  const pathnameRef = useRef(pathname);
  const metaCacheRef = useRef<Map<string, { project_number: string; title: string }>>(
    new Map(),
  );
  const seenIdsRef = useRef<Set<string>>(new Set());
  const pendingRef = useRef<Map<string, PendingProject>>(new Map());
  const queuedRowsRef = useRef<RawRow[]>([]);
  const modalOpenRef = useRef(false);
  const openingRef = useRef(false);
  const channelRef = useRef<{ remove: () => void } | null>(null);

  const chatPathFor = useCallback((projectId: string) => {
    return `/profile/projects/${projectId}/messages`;
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
      // Currently reading this exact conversation — ProjectChat owns the
      // thread there and will mark the message read. No modal.
      if (pathnameRef.current === chatPathFor(row.projectId)) {
        return;
      }

      const cached = metaCacheRef.current.get(row.projectId);
      let resolved: { project_number: string; title: string } | null = cached ?? null;
      if (!resolved && client) {
        try {
          const { data } = await client
            .from("projects")
            .select("project_number, title")
            .eq("id", row.projectId)
            .maybeSingle();
          resolved = data ?? null;
        } catch {
          resolved = null;
        }
      }
      if (!resolved) {
        return;
      }
      metaCacheRef.current.set(row.projectId, resolved);

      const existing = pendingRef.current.get(row.projectId);
      if (existing) {
        existing.count += 1;
        existing.latest = preview(row.message);
        existing.latestAt = row.createdAt;
      } else {
        pendingRef.current.set(row.projectId, {
          projectId: row.projectId,
          number: resolved.project_number,
          title: resolved.title,
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
        sender_id?: unknown;
        message?: unknown;
        created_at?: unknown;
      };
      if (typeof row.id !== "string" || typeof row.project_id !== "string") {
        return;
      }
      const id: string = row.id;
      const currentId = viewerIdRef.current;
      if (!currentId || row.sender_id === currentId || seenIdsRef.current.has(id)) {
        return;
      }
      seenIdsRef.current.add(id);
      const raw: RawRow = {
        id,
        projectId: row.project_id,
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
      setViewerId(user.id);
      setActive(true);

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
      router.push(chatPathFor(snapshot.data.projectId));
    } else {
      // Several projects have new messages — the Messages hub lists them all.
      router.push("/profile/messages");
    }
  }, [modal, router, chatPathFor]);

  if (!active || !viewerId) {
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
              modal.projectCount === 1 ? "project" : "projects"
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
