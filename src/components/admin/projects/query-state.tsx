import type { ReactNode } from "react";
import Link from "next/link";
import type { QueryResult } from "@/lib/admin-project-constants";

export function QueryStateNotice({
  result,
  emptyMessage,
  clearHref,
}: {
  result: Extract<QueryResult<unknown>, { status: "error" | "unavailable" | "empty" }>;
  emptyMessage?: string;
  clearHref?: string;
}) {
  if (result.status === "empty") {
    return (
      <div className="rounded-3xl border border-dashed border-card-border bg-card p-6 text-sm text-muted">
        <p>{emptyMessage ?? "Nothing to show yet."}</p>
        {clearHref ? (
          <Link
            href={clearHref}
            className="mt-3 inline-block rounded-xl border border-card-border px-3 py-2 text-sm font-medium text-foreground hover:border-foreground"
          >
            Clear search/filters
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={`rounded-3xl border p-6 text-sm ${
        result.status === "error"
          ? "border-red-500/20 bg-red-500/5 text-red-600"
          : "border-card-border bg-card text-muted"
      }`}
    >
      {result.status === "unavailable" ? "Schema limitation. " : "Could not load this data. "}
      {result.message}
    </div>
  );
}

export function AdminPanel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-card-border bg-card p-6">
      <header className="mb-4">
        <h3 className="font-display text-lg text-foreground">{title}</h3>
        {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      </header>
      {children}
    </section>
  );
}

export function StatusPill({
  label,
  className,
}: {
  label: string;
  className: string;
}) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}
