import Link from "next/link";
import type { DashboardActionItem } from "@/lib/admin-dashboard";
import { DashboardChevron } from "@/components/admin/dashboard/dashboard-section";
import { QueryNotice } from "@/components/admin/dashboard/query-notice";
import { buildInvoicesHref } from "@/lib/admin-invoice-constants";

const ACTION_HREFS: Record<string, string> = {
  quotes: "/admin/quotes",
  "overdue-invoices": buildInvoicesHref({ status: "overdue" }),
  "unread-messages": "/admin/projects",
  "referral-rewards": "/admin/referrals",
};

const cardClassName =
  "group flex h-full flex-col rounded-3xl border border-card-border bg-card p-6 text-left transition-colors";

const linkedCardClassName =
  `${cardClassName} hover:border-foreground/25 hover:bg-accent-soft/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring`;

function actionHref(id: string): string | undefined {
  return ACTION_HREFS[id];
}

function ActionCardBody({ item }: { item: DashboardActionItem }) {
  if (item.state === "error" || item.state === "unavailable") {
    return (
      <>
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
      </>
    );
  }

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <h4 className="font-display text-lg tracking-tight">{item.label}</h4>
        <span className="rounded-full border border-card-border bg-background px-3 py-1 text-xs font-medium tracking-wide text-muted">
          {item.count}
        </span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        {item.state === "empty" ? "Nothing waiting right now." : item.description}
      </p>
    </>
  );
}

export function ActionItemCard({ item }: { item: DashboardActionItem }) {
  const href = actionHref(item.id);

  if (href) {
    return (
      <Link
        href={href}
        aria-label={`View all ${item.label}`}
        className={linkedCardClassName}
      >
        <ActionCardBody item={item} />
        <span className="mt-4 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-foreground">
          View all
          <DashboardChevron className="transition-transform group-hover:translate-x-0.5" />
        </span>
      </Link>
    );
  }

  return (
    <article className={cardClassName}>
      <ActionCardBody item={item} />
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
