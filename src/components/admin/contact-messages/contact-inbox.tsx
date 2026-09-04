"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { StatusPill } from "@/components/admin/projects/query-state";
import { openContactMessage, setContactMessageStatus } from "@/lib/admin-contact-actions";
import {
  allowedContactActions,
  buildReplyMailto,
  CONTACT_ACTION_LABELS,
  formatContactStatusLabel,
  formatDate,
  formatDateTime,
  getContactStatusStyle,
  messageSnippet,
  type ContactInboxAction,
  type ContactMessageRow,
} from "@/lib/admin-contact-constants";

type ActionResult = { ok: true } | { ok: false; error: string };

function confirmFor(action: ContactInboxAction): string | null {
  switch (action) {
    case "archive":
      return "Archive this message? It moves out of the active inbox.";
    case "spam":
      return "Mark this message as spam?";
    case "restore":
      return null;
    default:
      return null;
  }
}

function buttonClass(action: ContactInboxAction): string {
  switch (action) {
    case "replied":
      return "rounded-xl bg-emerald-600 px-3 py-2 text-sm font-medium text-white";
    case "archive":
      return "rounded-xl border border-card-border px-3 py-2 text-sm font-medium text-foreground hover:border-foreground";
    case "spam":
      return "rounded-xl bg-red-600 px-3 py-2 text-sm font-medium text-white";
    case "restore":
      return "rounded-xl border border-card-border px-3 py-2 text-sm font-medium text-foreground hover:border-foreground";
    default:
      return "rounded-xl bg-foreground px-3 py-2 text-sm font-medium text-background";
  }
}

export function ContactInbox({ messages }: { messages: ContactMessageRow[] }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selected = messages.find((item) => item.id === selectedId) ?? null;

  function select(messageId: string) {
    setSelectedId(messageId);
    setMessage(null);
    const target = messages.find((item) => item.id === messageId);
    // Safe auto-read: only "new" messages transition, read_at is set exactly once.
    if (target && target.status === "new") {
      run(openContactMessage, { messageId });
    }
  }

  function run(
    action: (formData: FormData) => Promise<ActionResult>,
    hidden: Record<string, string>,
  ) {
    setMessage(null);
    startTransition(async () => {
      const data = new FormData();
      for (const [name, value] of Object.entries(hidden)) data.set(name, value);
      const result = await action(data);
      if (!result.ok) {
        setMessage(result.error);
      } else {
        router.refresh();
      }
    });
  }

  function moderate(action: ContactInboxAction) {
    if (!selected) {
      return;
    }
    const confirmText = confirmFor(action);
    if (confirmText && !window.confirm(confirmText)) {
      return;
    }
    setBusy(action);
    const data = new FormData();
    data.set("messageId", selected.id);
    data.set("action", action);
    startTransition(async () => {
      const result = await setContactMessageStatus(data);
      setBusy(null);
      if (!result.ok) {
        setMessage(result.error);
      } else {
        setMessage(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      {/* List pane */}
      <div className="max-h-[70vh] overflow-y-auto rounded-3xl border border-card-border bg-card">
        <ul className="divide-y divide-card-border/60">
          {messages.map((item) => {
            const unread = item.status === "new";
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => select(item.id)}
                  className={`flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-foreground/[0.03] ${
                    selectedId === item.id ? "bg-foreground/[0.04]" : ""
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span
                      className={`flex items-center gap-2 truncate text-sm ${
                        unread
                          ? "font-semibold text-foreground"
                          : "font-medium text-foreground/80"
                      }`}
                    >
                      {unread ? (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-accent" aria-label="Unread" />
                      ) : null}
                      <span className="truncate">{item.name}</span>
                    </span>
                    <span className="shrink-0 text-right text-xs text-muted">
                      {formatDate(item.created_at)}
                      {item.replied_at ? (
                        <span className="block">Replied {formatDate(item.replied_at)}</span>
                      ) : null}
                    </span>
                  </span>
                  <span
                    className={`truncate text-sm ${unread ? "text-foreground" : "text-muted"}`}
                  >
                    {item.subject || "(no subject)"}
                  </span>
                  {item.email ? (
                    <span className="truncate text-xs text-muted">{item.email}</span>
                  ) : null}
                  <span className="truncate text-xs text-muted">
                    {messageSnippet(item.message)}
                  </span>
                  <span className="mt-0.5">
                    <StatusPill
                      label={formatContactStatusLabel(item.status)}
                      className={getContactStatusStyle(item.status)}
                    />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Detail pane */}
      <div className="rounded-3xl border border-card-border bg-card p-5">
        {!selected ? (
          <div className="flex h-full min-h-[18rem] items-center justify-center">
            <p className="text-sm text-muted">
              Select a message to read it. Unread messages are marked as read automatically.
            </p>
          </div>
        ) : (
          <article>
            <header className="flex flex-wrap items-start justify-between gap-3 border-b border-card-border/60 pb-4">
              <div className="min-w-0">
                <h3 className="font-display text-xl text-foreground">
                  {selected.subject || "(no subject)"}
                </h3>
                <p className="mt-1 text-sm text-foreground">
                  From{" "}
                  <span className="font-medium">{selected.name}</span>
                  {selected.email ? (
                    <>
                      {" "}
                      <a
                        href={`mailto:${selected.email}`}
                        className="text-muted hover:text-foreground"
                      >
                        &lt;{selected.email}&gt;
                      </a>
                    </>
                  ) : null}
                  {selected.phone ? (
                    <span className="text-muted"> · {selected.phone}</span>
                  ) : null}
                </p>
              </div>
              <StatusPill
                label={formatContactStatusLabel(selected.status)}
                className={getContactStatusStyle(selected.status)}
              />
            </header>

            <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted">
              <div>
                <dt className="inline">Received:</dt>{" "}
                <dd className="inline">{formatDateTime(selected.created_at)}</dd>
              </div>
              {selected.read_at ? (
                <div>
                  <dt className="inline">Read:</dt>{" "}
                  <dd className="inline">{formatDateTime(selected.read_at)}</dd>
                </div>
              ) : null}
              {selected.replied_at ? (
                <div>
                  <dt className="inline">Replied:</dt>{" "}
                  <dd className="inline">{formatDateTime(selected.replied_at)}</dd>
                </div>
              ) : null}
            </dl>

            <div className="mt-4 whitespace-pre-line rounded-2xl bg-background p-4 text-sm leading-relaxed text-foreground">
              {selected.message}
            </div>

            <footer className="mt-5 flex flex-wrap items-center gap-2 border-t border-card-border/60 pt-4">
              <a
                href={buildReplyMailto(selected)}
                className="rounded-xl bg-foreground px-3 py-2 text-sm font-medium text-background"
              >
                Reply in email client
              </a>
              {allowedContactActions(selected.status)
                .filter((action) => action !== "read")
                .map((action) => {
                const label = CONTACT_ACTION_LABELS[action];
                return (
                  <button
                    key={action}
                    type="button"
                    disabled={pending && busy === action}
                    onClick={() => moderate(action)}
                    className={`disabled:opacity-60 ${buttonClass(action)}`}
                  >
                    {label}
                  </button>
                );
              })}
            </footer>

            <p className="mt-3 text-xs leading-5 text-muted">
              Replying composes a message in your email client — no email is
              sent from this app (no provider is wired up yet). Use “Mark as
              replied” once you have sent it.
            </p>
            {message ? (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">
                {message}
              </p>
            ) : null}
          </article>
        )}
      </div>
    </div>
  );
}
