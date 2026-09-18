"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import {
  buildProjectsHref,
  formatPriorityLabel,
  formatStatusLabel,
  PROJECT_PRIORITIES,
  PROJECT_STATUSES,
  type ProjectListFilters,
  type ProjectSortField,
} from "@/lib/admin-project-constants";

const SORT_OPTIONS: Array<{ value: ProjectSortField; label: string }> = [
  { value: "created_at", label: "Created" },
  { value: "updated_at", label: "Updated" },
  { value: "project_number", label: "Project number" },
  { value: "title", label: "Title" },
  { value: "status", label: "Status" },
  { value: "priority", label: "Priority" },
  { value: "due_date", label: "Due date" },
  { value: "start_date", label: "Start date" },
  { value: "agreed_price", label: "Budget" },
];

export function ProjectsToolbar({ filters }: { filters: ProjectListFilters }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const view = filters.view === "kanban" ? "kanban" : "list";
  const urlQuery = filters.q ?? "";
  const [query, setQuery] = useState(urlQuery);
  const [syncedQuery, setSyncedQuery] = useState(urlQuery);

  if (urlQuery !== syncedQuery) {
    setSyncedQuery(urlQuery);
    setQuery(urlQuery);
  }

  const update = useCallback(
    (next: Partial<ProjectListFilters>) => {
      const merged: ProjectListFilters = { ...filters, ...next };
      delete merged.page;
      startTransition(() => {
        router.push(buildProjectsHref(merged));
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
      className="mb-6 grid gap-3 rounded-3xl border border-card-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_10rem_10rem_9rem_auto]"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        update({
          q: String(data.get("q") ?? "").trim(),
          status: String(data.get("status") ?? "all"),
          priority: String(data.get("priority") ?? "all"),
          sort: String(data.get("sort") ?? "created_at"),
          dir: String(data.get("dir") ?? "desc"),
        });
      }}
    >
      <input
        name="q"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search by project name, client, project ID, email..."
        className="rounded-xl border border-card-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent sm:col-span-2 lg:col-span-1"
      />
      <select
        name="status"
        value={filters.status && filters.status !== "all" ? filters.status : "all"}
        onChange={(event) => update({ status: event.target.value })}
        className="rounded-xl border border-card-border bg-background px-3 py-2 text-sm text-foreground"
      >
        <option value="all">All statuses</option>
        {PROJECT_STATUSES.map((status) => (
          <option key={status} value={status}>
            {formatStatusLabel(status)}
          </option>
        ))}
      </select>
      <select
        name="priority"
        value={filters.priority && filters.priority !== "all" ? filters.priority : "all"}
        onChange={(event) => update({ priority: event.target.value })}
        className="rounded-xl border border-card-border bg-background px-3 py-2 text-sm text-foreground"
      >
        <option value="all">All priorities</option>
        {PROJECT_PRIORITIES.map((priority) => (
          <option key={priority} value={priority}>
            {formatPriorityLabel(priority)}
          </option>
        ))}
      </select>
      <select
        name="sort"
        value={filters.sort ?? "created_at"}
        onChange={(event) => update({ sort: event.target.value })}
        className="rounded-xl border border-card-border bg-background px-3 py-2 text-sm text-foreground"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <div className="flex gap-2">
        <select
          name="dir"
          value={filters.dir ?? "desc"}
          onChange={(event) => update({ dir: event.target.value })}
          className="min-w-0 flex-1 rounded-xl border border-card-border bg-background px-3 py-2 text-sm text-foreground"
        >
          <option value="desc">Desc</option>
          <option value="asc">Asc</option>
        </select>
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-60"
        >
          Apply
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-5">
        <button
          type="button"
          onClick={() => update({ view: "list" })}
          className={`rounded-full border px-3 py-1 text-xs font-medium ${
            view === "list"
              ? "border-foreground bg-foreground text-background"
              : "border-card-border text-muted hover:text-foreground"
          }`}
        >
          List
        </button>
        <button
          type="button"
          onClick={() => update({ view: "kanban" })}
          className={`rounded-full border px-3 py-1 text-xs font-medium ${
            view === "kanban"
              ? "border-foreground bg-foreground text-background"
              : "border-card-border text-muted hover:text-foreground"
          }`}
        >
          Kanban
        </button>
        {filters.q ||
        (filters.status && filters.status !== "all") ||
        (filters.priority && filters.priority !== "all") ? (
          <button
            type="button"
            onClick={() =>
              startTransition(() => {
                router.push(
                  buildProjectsHref({
                    view: filters.view,
                    sort: filters.sort,
                    dir: filters.dir,
                  }),
                );
              })
            }
            className="rounded-full border border-card-border px-3 py-1 text-xs font-medium text-muted hover:text-foreground"
          >
            Clear search/filters
          </button>
        ) : null}
      </div>
    </form>
  );
}
