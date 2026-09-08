import Link from "next/link";
import type { DashboardMetric } from "@/lib/admin-dashboard";
import { DashboardChevron } from "@/components/admin/dashboard/dashboard-section";
import { QueryNotice } from "@/components/admin/dashboard/query-notice";
import { buildPaymentsHref } from "@/lib/admin-invoice-constants";

const METRIC_HREFS: Record<string, string> = {
  "leads-today": "/admin/project-requests",
  "active-projects": "/admin/projects",
  "open-invoices": "/admin/invoices",
  "month-revenue": buildPaymentsHref({ status: "succeeded" }),
};

const cardClassName =
  "group flex h-full flex-col rounded-3xl border border-card-border bg-card p-6 text-left transition-colors";

const linkedCardClassName =
  `${cardClassName} hover:border-foreground/25 hover:bg-accent-soft/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring`;

function metricHref(id: string): string | undefined {
  return METRIC_HREFS[id];
}

function StatCardBody({ metric }: { metric: DashboardMetric }) {
  if (metric.state === "error" || metric.state === "unavailable") {
    return (
      <>
        <p className="text-xs font-medium tracking-[0.16em] text-muted uppercase">
          {metric.label}
        </p>
        <QueryNotice
          state={{
            status: metric.state,
            message: metric.message ?? "This metric is unavailable.",
          }}
        />
      </>
    );
  }

  return (
    <>
      <p className="text-xs font-medium tracking-[0.16em] text-muted uppercase">
        {metric.label}
      </p>
      <p className="mt-3 font-display text-3xl tracking-tight text-foreground">
        {metric.value}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        {metric.description}
      </p>
    </>
  );
}

function ViewAllCue() {
  return (
    <span className="mt-4 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-foreground">
      View all
      <DashboardChevron className="transition-transform group-hover:translate-x-0.5" />
    </span>
  );
}

export function StatCard({ metric }: { metric: DashboardMetric }) {
  const href = metricHref(metric.id);

  if (href) {
    return (
      <Link
        href={href}
        aria-label={`View all ${metric.label}`}
        className={linkedCardClassName}
      >
        <StatCardBody metric={metric} />
        <ViewAllCue />
      </Link>
    );
  }

  return (
    <article className={cardClassName}>
      <StatCardBody metric={metric} />
    </article>
  );
}

export function StatCardGrid({ metrics }: { metrics: DashboardMetric[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <StatCard key={metric.id} metric={metric} />
      ))}
    </div>
  );
}
