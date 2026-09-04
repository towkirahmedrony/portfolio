"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  buildReferralsHref,
  formatReferralStatusLabel,
  REFERRAL_STATUSES,
  type ReferralListFilters,
  type ReferralSortField,
} from "@/lib/admin-referral-constants";

const SORT_OPTIONS: Array<{ value: ReferralSortField; label: string }> = [
  { value: "created_at", label: "Created" },
  { value: "qualified_at", label: "Qualified" },
  { value: "completed_at", label: "Completed" },
  { value: "status", label: "Status" },
  { value: "client_discount_percent", label: "Client discount" },
  { value: "referrer_reward_percent", label: "Referrer reward" },
];

export function ReferralsToolbar({ filters }: { filters: ReferralListFilters }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function update(next: Partial<ReferralListFilters>) {
    const merged: ReferralListFilters = { ...filters, ...next };
    delete merged.page;
    startTransition(() => {
      router.push(buildReferralsHref(merged));
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
        placeholder="Search referrer, referred client, code"
        className="rounded-xl border border-card-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent lg:col-span-2"
      />
      <select
        name="status"
        defaultValue={filters.status ?? "all"}
        className="rounded-xl border border-card-border bg-background px-3 py-2 text-sm text-foreground"
      >
        <option value="all">All statuses</option>
        {REFERRAL_STATUSES.map((status) => (
          <option key={status} value={status}>
            {formatReferralStatusLabel(status)}
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
        Referral relationships live in the referrals table; reward lifecycle is
        tracked separately in referral_rewards and is never altered here.
      </p>
    </form>
  );
}
