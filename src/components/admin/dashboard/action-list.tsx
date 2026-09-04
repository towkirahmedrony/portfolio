import type { DashboardActionItem } from "@/lib/admin-dashboard";
import { QueryNotice } from "@/components/admin/dashboard/query-notice";

export function ActionItemCard({ item }: { item: DashboardActionItem }) {
  if (item.state === "error" || item.state === "unavailable") {
    return (
      <article className="rounded-3xl border border-card-border bg-card p-6">
        <div className="flex items-start justify-between gap-4">
          <h4 className="font-display text-lg tracking-tight">{item.label}</h4>
          <span className="rounded-full border border-card-border bg-background px-3 py-1 text-xs font-medium tracking-wide text-muted">
            —
          </span>
        </div>
        <QueryNotice
          state={{
            status: item.state,
            message: item.message ?? "This queue is unavailable.",
          }}
        />
      </article>
    );
  }

  return (
    <article className="rounded-3xl border border-card-border bg-card p-6">
      <div className="flex items-start justify-between gap-4">
        <h4 className="font-display text-lg tracking-tight">{item.label}</h4>
        <span className="rounded-full border border-card-border bg-background px-3 py-1 text-xs font-medium tracking-wide text-muted">
          {item.count}
        </span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        {item.state === "empty" ? "Nothing waiting right now." : item.description}
      </p>
    </article>
  );
}

export function ActionItemGrid({ items }: { items: DashboardActionItem[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {items.map((item) => (
        <ActionItemCard key={item.id} item={item} />
      ))}
    </div>
  );
}
