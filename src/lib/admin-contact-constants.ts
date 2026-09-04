import type { QueryResult } from "@/lib/admin-project-constants";
import type { ContactMessageRow, ContactStatus } from "@/types/database";

export { formatDate, formatDateTime } from "@/lib/admin-project-constants";
export type { QueryResult, ContactMessageRow, ContactStatus };

export const CONTACT_STATUSES: ContactStatus[] = [
  "new",
  "read",
  "replied",
  "archived",
  "spam",
];

export const CONTACT_STATUS_LABELS: Record<ContactStatus, string> = {
  new: "New",
  read: "Read",
  replied: "Replied",
  archived: "Archived",
  spam: "Spam",
};

export const CONTACT_STATUS_STYLES: Record<ContactStatus, string> = {
  new: "bg-blue-500/10 text-blue-700 border-blue-500/20 dark:text-blue-400",
  read: "bg-neutral-500/10 text-neutral-600 border-neutral-500/20 dark:text-neutral-400",
  replied: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400",
  archived: "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400",
  spam: "bg-red-500/10 text-red-700 border-red-500/20 dark:text-red-400",
};

/** Inbox actions available to the admin. */
export type ContactInboxAction = "read" | "replied" | "archive" | "spam" | "restore";

export const CONTACT_ACTION_LABELS: Record<ContactInboxAction, string> = {
  read: "Mark as read",
  replied: "Mark as replied",
  archive: "Archive",
  spam: "Mark as spam",
  restore: "Restore",
};

export type ContactOutcome =
  | {
      ok: true;
      updates: Partial<
        Pick<ContactMessageRow, "status" | "read_at" | "replied_at">
      >;
    }
  | { ok: false; reason: string };

/**
 * Which inbox actions are allowed for a message. restore is only offered for
 * archived/spam messages and puts them back in the read state.
 */
export function allowedContactActions(
  status: ContactStatus,
): ContactInboxAction[] {
  switch (status) {
    case "new":
      return ["read", "replied", "archive", "spam"];
    case "read":
      return ["read", "replied", "archive", "spam"];
    case "replied":
      return ["archive", "spam"];
    case "archived":
      return ["restore", "spam"];
    case "spam":
      return ["restore"];
    default:
      return [];
  }
}

/** Applies an inbox action to a message's status/timestamps. */
export function applyContactAction(
  message: Pick<ContactMessageRow, "status" | "read_at" | "replied_at">,
  action: ContactInboxAction,
): ContactOutcome {
  const { status, read_at, replied_at } = message;
  const allowed = allowedContactActions(status);

  if (!allowed.includes(action)) {
    return {
      ok: false,
      reason: `"${CONTACT_ACTION_LABELS[action]}" is not allowed while the message is ${CONTACT_STATUS_LABELS[status].toLowerCase()}.`,
    };
  }

  switch (action) {
    case "read":
      return { ok: true, updates: { status: "read", read_at: read_at ?? new Date().toISOString() } };
    case "replied":
      return {
        ok: true,
        updates: {
          status: "replied",
          read_at: read_at ?? new Date().toISOString(),
          replied_at: replied_at ?? new Date().toISOString(),
        },
      };
    case "archive":
      return { ok: true, updates: { status: "archived" } };
    case "spam":
      return { ok: true, updates: { status: "spam" } };
    case "restore":
      return { ok: true, updates: { status: "read" } };
    default:
      return { ok: false, reason: "Unknown action." };
  }
}

export function formatContactStatusLabel(status: string): string {
  if (CONTACT_STATUSES.includes(status as ContactStatus)) {
    return CONTACT_STATUS_LABELS[status as ContactStatus];
  }
  return status.replace(/_/g, " ");
}

export function getContactStatusStyle(status: string): string {
  if (CONTACT_STATUSES.includes(status as ContactStatus)) {
    return CONTACT_STATUS_STYLES[status as ContactStatus];
  }
  return "border-card-border bg-background text-muted";
}

export function isContactStatus(value: string): value is ContactStatus {
  return CONTACT_STATUSES.includes(value as ContactStatus);
}

export function isContactInboxAction(value: string): value is ContactInboxAction {
  return (
    value === "read" ||
    value === "replied" ||
    value === "archive" ||
    value === "spam" ||
    value === "restore"
  );
}

export type ContactFilters = { q?: string; status?: string };

/**
 * Reply extension point.
 *
 * No email provider is wired up in this codebase, so replying composes a
 * mailto: link in the admin's email client and marks the message replied.
 * When an email provider is integrated later, replace buildReplyMailto with a
 * real send implementation — the markReplied action already exists and keeps
 * status/replied_at consistent regardless of the transport.
 */
export function buildReplyMailto(message: ContactMessageRow): string {
  const subject = message.subject
    ? `Re: ${message.subject}`
    : `Re: your message to us`;
  const body = [
    `Hi ${message.name},`,
    "",
    "",
    "—",
    "Previous message:",
    "",
    message.message,
  ].join("\n");
  const params = new URLSearchParams({ subject, body });
  return `mailto:${encodeURIComponent(message.email)}?${params.toString()}`;
}

export function messageSnippet(message: string, maxLength = 120): string {
  const singleLine = message.replace(/\s+/g, " ").trim();
  return singleLine.length > maxLength
    ? `${singleLine.slice(0, maxLength)}…`
    : singleLine;
}
