"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  AUDIT_SORT_OPTIONS,
  buildAuditHref,
  type AuditActorOption,
  type AuditLogFilters,
} from "@/lib/admin-audit-constants";

const fieldClass =
  "rounded-xl border border-card-border bg-background px-3 py-2 text-sm text-foreground";

export function AuditToolbar({
  filters,
  actors,
  actions,
  entities,
}: {
  filters: AuditLogFilters;
  actors: AuditActorOption[];
  actions: string[];
  entities: string[];
}) {
  const router = useRouter();
  const [q, setQ] = useState(filters.q ?? "");
  const [from, setFrom] = useState(filters.from ?? "");
  const [to, setTo] = useState(filters.to ?? "");
  const [pending, startTransition] = useTransition();

  function apply(next: AuditLogFilters) {
    startTransition(() => {
      router.push(buildAuditHref(next));
    });
  }

  return (
    <form
      className="mb-6 grid gap-3 rounded-3xl border border-card-border bg-card p-4 lg:grid-cols-[minmax(0,1fr)_repeat(4,auto)]"
      onSubmit={(event) => {
        event.preventDefault();
        apply({
          ...filters,
          q,
          actor: String(new FormData(event.currentTarget).get("actor") ?? "all"),
          action: String(new FormData(event.currentTarget).get("action") ?? "all"),
          entity: String(new FormData(event.currentTarget).get("entity") ?? "all"),
          from,
          to,
          sort: String(new FormData(event.currentTarget).get("sort") ?? "desc"),
        });
      }}
    >
      <input
        name="q"
        value={q}
        onChange={(event) => setQ(event.target.value)}
        placeholder="Search action or entity type"
        className={fieldClass}
      />
      <select name="actor" defaultValue={filters.actor ?? "all"} className={fieldClass}>
        <option value="all">Any actor</option>
        {actors.map((actor) => (
          <option key={actor.id} value={actor.id}>
            {actor.name}
          </option>
        ))}
      </select>
      <select name="action" defaultValue={filters.action ?? "all"} className={fieldClass}>
        <option value="all">Any action</option>
        {actions.map((action) => (
          <option key={action} value={action}>
            {action}
          </option>
        ))}
      </select>
      <select name="entity" defaultValue={filters.entity ?? "all"} className={fieldClass}>
        <option value="all">Any entity</option>
        {entities.map((entity) => (
          <option key={entity} value={entity}>
            {entity}
          </option>
        ))}
      </select>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:flex lg:items-center">
        <label className="flex items-center gap-1 text-xs text-muted">
          <span>From</span>
          <input
            type="date"
            name="fromDate"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className={`${fieldClass} w-36 px-2 py-1.5`}
          />
        </label>
        <label className="flex items-center gap-1 text-xs text-muted">
          <span>To</span>
          <input
            type="date"
            name="toDate"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className={`${fieldClass} w-36 px-2 py-1.5`}
          />
        </label>
        <select
          name="sort"
          defaultValue={filters.sort ?? "desc"}
          className={`${fieldClass} px-2 py-1.5`}
        >
          {AUDIT_SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-xl bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-60"
          >
            Apply
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setQ("");
              setFrom("");
              setTo("");
              startTransition(() => {
                router.push("/admin/audit-logs");
              });
            }}
            className="rounded-xl border border-card-border px-3 py-2 text-sm font-medium text-foreground disabled:opacity-60"
          >
            Reset
          </button>
        </div>
      </div>
    </form>
  );
}
