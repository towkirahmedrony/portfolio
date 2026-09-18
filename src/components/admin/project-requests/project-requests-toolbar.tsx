"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import {
  buildProjectRequestsHref,
  formatRequestStatusLabel,
  REQUEST_STATUSES,
  type ProjectRequestListFilters,
} from "@/lib/admin-project-request-constants";

export function ProjectRequestsToolbar({
  filters,
}: {
  filters: ProjectRequestListFilters;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const activeStatus = filters.status && filters.status !== "all" ? filters.status : "all";
  const urlQuery = filters.q ?? "";
  const [query, setQuery] = useState(urlQuery);
  const [syncedQuery, setSyncedQuery] = useState(urlQuery);

  if (urlQuery !== syncedQuery) {
    setSyncedQuery(urlQuery);
    setQuery(urlQuery);
  }

  const update = useCallback(
    (next: Partial<ProjectRequestListFilters>) => {
      const merged: ProjectRequestListFilters = { ...filters, ...next };
      delete merged.page;
      startTransition(() => {
        router.push(buildProjectRequestsHref(merged));
      });
    },
    [filters, router],
  );

  useEffect(() => {
    const next = query.trim();
    if (next === urlQuery.trim()) {
      return;
    }
    const handle = window.setTimeout(() => {
      update({ q: next });
    }, 300);
    return () => window.clearTimeout(handle);
  }, [query, urlQuery, update]);

  return (
    <form
      className="mb-6 grid gap-3 rounded-3xl border border-card-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_12rem_11rem_auto]"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        update({
          q: String(data.get("q") ?? "").trim(),
          status: String(data.get("status") ?? "all"),
          dir: String(data.get("dir") ?? "desc"),
        });
      }}
    >
      <input
        name="q"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search by request ID, client, email..."
        className="rounded-xl border border-card-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent sm:col-span-2 lg:col-span-1"
      />
      <select
        name="status"
        value={activeStatus}
        onChange={(event) => update({ status: event.target.value })}
        className="rounded-xl border border-card-border bg-background px-3 py-2 text-sm text-foreground"
      >
        <option value="all">All statuses</option>
        {REQUEST_STATUSES.map((status) => (
          <option key={status} value={status}>
            {formatRequestStatusLabel(status)}
          </option>
        ))}
      </select>
      <select
        name="dir"
        value={filters.dir ?? "desc"}
        onChange={(event) => update({ dir: event.target.value })}
        className="rounded-xl border border-card-border bg-background px-3 py-2 text-sm text-foreground"
      >
        <option value="desc">Newest first</option>
        <option value="asc">Oldest first</option>
      </select>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="flex-1 rounded-xl bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-60"
        >
          Apply
        </button>
        {filters.q || (filters.status && filters.status !== "all") ? (
          <button
            type="button"
            onClick={() =>
              startTransition(() => {
                router.push(buildProjectRequestsHref({ dir: filters.dir }));
              })
            }
            className="rounded-xl border border-card-border px-3 py-2 text-sm font-medium text-muted hover:text-foreground"
          >
            Clear
          </button>
        ) : null}
      </div>
    </form>
  );
}
