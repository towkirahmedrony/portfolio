import Link from "next/link";

export const fieldClass =
  "w-full rounded-xl border border-card-border bg-background px-3 py-2 text-sm text-foreground";
export const labelClass = "grid gap-1 text-sm";

export function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${
        active
          ? "border-transparent bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
          : "border-card-border bg-background text-muted"
      }`}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

export function ConversationStatusBadge({ status }: { status: "active" | "closed" }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${
        status === "active"
          ? "border-transparent bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
          : "border-card-border bg-background text-muted"
      }`}
    >
      {status === "active" ? "Active" : "Closed"}
    </span>
  );
}

export function IdentityBadge({ anonymous }: { anonymous: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${
        anonymous
          ? "border-card-border bg-background text-muted"
          : "border-transparent bg-blue-500/10 text-blue-700 dark:text-blue-400"
      }`}
    >
      {anonymous ? "Anonymous" : "Logged-in"}
    </span>
  );
}

export function EmptyPanel({
  message,
  actionHref,
  actionLabel,
}: {
  message: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-card-border bg-card p-10 text-center">
      <p className="text-sm text-muted">{message}</p>
      {actionHref && actionLabel ? (
        <Link
          href={actionHref}
          className="mt-4 inline-flex rounded-xl bg-foreground px-3 py-2 text-sm font-medium text-background"
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}


