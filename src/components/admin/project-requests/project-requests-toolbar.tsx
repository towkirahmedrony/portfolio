"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
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

  function update(next: Partial<ProjectRequestListFilters>) {
    startTransition(() => {
      router.push(buildProjectRequestsHref({ ...filters, ...next }));
    });
  }

  return (
    <form
      className="mb-6 grid gap-3 rounded-3xl border border-card-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-6"
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
        defaultValue={filters.q ?? ""}
        placeholder="Search number, name, email, or project type"
        className="rounded-xl border border-card-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent lg:col-span-2"
      />
      <select
        name="status"
        defaultValue={activeStatus}
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
        defaultValue={filters.dir ?? "desc"}
        className="rounded-xl border border-card-border bg-background px-3 py-2 text-sm text-foreground"
      >
        <option value="desc">Newest first</option>
        <option value="asc">Oldest first</option>
      </select>
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-60"
      >
        Apply
      </button>
    </form>
  );
}
