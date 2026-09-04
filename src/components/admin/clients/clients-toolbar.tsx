"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  buildClientsHref,
  CLIENT_PROFILE_STATUSES,
  formatClientStatusLabel,
  type ClientListFilters,
  type ClientSortField,
} from "@/lib/admin-client-constants";

const SORT_OPTIONS: Array<{ value: ClientSortField; label: string }> = [
  { value: "created_at", label: "Member since" },
  { value: "updated_at", label: "Updated" },
  { value: "last_seen_at", label: "Last active" },
  { value: "full_name", label: "Name" },
  { value: "display_name", label: "Display name" },
  { value: "company_name", label: "Company" },
  { value: "status", label: "Account status" },
];

export function ClientsToolbar({ filters }: { filters: ClientListFilters }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function update(next: Partial<ClientListFilters>) {
    // Any filter change starts again from page 1.
    const merged: ClientListFilters = { ...filters, ...next };
    delete merged.page;
    startTransition(() => {
      router.push(buildClientsHref(merged));
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
          sort: String(data.get("sort") ?? "created_at"),
          dir: String(data.get("dir") ?? "desc"),
        });
      }}
    >
      <input
        name="q"
        defaultValue={filters.q ?? ""}
        placeholder="Search name, display name, company, phone, job title"
        className="rounded-xl border border-card-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent lg:col-span-2"
      />
      <select
        name="status"
        defaultValue={filters.status ?? "all"}
        className="rounded-xl border border-card-border bg-background px-3 py-2 text-sm text-foreground"
      >
        <option value="all">All statuses</option>
        {CLIENT_PROFILE_STATUSES.map((status) => (
          <option key={status} value={status}>
            {formatClientStatusLabel(status)}
          </option>
        ))}
      </select>
      <select
        name="sort"
        defaultValue={filters.sort ?? "created_at"}
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
          defaultValue={filters.dir ?? "desc"}
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
      <p className="text-xs leading-5 text-muted sm:col-span-2 lg:col-span-6">
        Only accounts with role “client” are shown. Email is read from
        auth.users and cannot be used for SQL search or sorting.
      </p>
    </form>
  );
}
