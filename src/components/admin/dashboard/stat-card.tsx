import type { DashboardMetric } from "@/lib/admin-dashboard";
import { QueryNotice } from "@/components/admin/dashboard/query-notice";

export function StatCard({ metric }: { metric: DashboardMetric }) {
  if (metric.state === "error" || metric.state === "unavailable") {
    return (
      <article className="rounded-3xl border border-card-border bg-card p-6">
        <p className="text-xs font-medium tracking-[0.16em] text-muted uppercase">
          {metric.label}
        </p>
        <QueryNotice
          state={{
            status: metric.state,
            message: metric.message ?? "This metric is unavailable.",
          }}
        />
      </article>
    );
  }

  return (
    <article className="rounded-3xl border border-card-border bg-card p-6">
      <p className="text-xs font-medium tracking-[0.16em] text-muted uppercase">
        {metric.label}
      </p>
      <p className="mt-3 font-display text-3xl tracking-tight text-foreground">
        {metric.value}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        {metric.description}
      </p>
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
