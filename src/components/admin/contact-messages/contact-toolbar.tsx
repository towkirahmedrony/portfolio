"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import {
  CONTACT_STATUS_LABELS,
  CONTACT_STATUSES,
  type ContactFilters,
} from "@/lib/admin-contact-constants";

const TABS = [
  { value: "all", label: "All" },
  ...CONTACT_STATUSES.map((status) => ({ value: status, label: CONTACT_STATUS_LABELS[status] })),
];

export function ContactToolbar({
  current,
  search,
}: {
  current: string;
  search: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState(search);
  const [pending, startTransition] = useTransition();

  function push(filters: ContactFilters) {
    startTransition(() => {
      const params = new URLSearchParams();
      if (filters.status && filters.status !== "all") params.set("status", filters.status);
      if (filters.q) params.set("q", filters.q);
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname);
    });
  }

  return (
    <div className="mb-6 space-y-3">
      <form
        className="grid gap-3 rounded-3xl border border-card-border bg-card p-4 sm:grid-cols-[minmax(0,1fr)_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          push({ status: current, q: String(data.get("q") ?? "").trim() });
        }}
      >
        <input
          name="q"
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Search name, email, subject, message"
          className="rounded-xl border border-card-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-60"
        >
          Search
        </button>
      </form>

      <div
        className="flex flex-wrap items-center gap-2 rounded-3xl border border-card-border bg-card p-2"
        role="tablist"
        aria-label="Filter messages by status"
      >
        {TABS.map((tab) => (
          <button
            key={tab.value}
            role="tab"
            aria-selected={current === tab.value}
            type="button"
            onClick={() => push({ status: tab.value, q: search })}
            disabled={pending}
            className={`rounded-2xl px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60 ${
              current === tab.value
                ? "bg-foreground text-background"
                : "text-muted hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
