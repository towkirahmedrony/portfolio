import type {
  DashboardActivityItem,
  DashboardQueryState,
} from "@/lib/admin-dashboard";
import {
  EmptyNotice,
  QueryNotice,
} from "@/components/admin/dashboard/query-notice";

export function ActivityFeed({
  activity,
}: {
  activity: DashboardQueryState<DashboardActivityItem[]>;
}) {
  if (activity.status === "error" || activity.status === "unavailable") {
    return (
      <div className="rounded-3xl border border-card-border bg-card p-6">
        <QueryNotice state={activity} />
      </div>
    );
  }

  if (activity.status === "empty") {
    return (
      <div className="rounded-3xl border border-dashed border-card-border bg-card p-6">
        <EmptyNotice>No recent audit activity yet.</EmptyNotice>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-card-border bg-card">
      <div className="hidden grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.4fr)_9.5rem] gap-4 border-b border-card-border px-6 py-3 text-xs font-medium tracking-[0.14em] text-muted uppercase sm:grid">
        <span>Actor</span>
        <span>Action</span>
        <span>Entity</span>
        <span>Time</span>
      </div>
      <ul className="divide-y divide-card-border">
        {activity.data.map((item) => (
          <li key={item.id} className="px-6 py-4">
            <div className="grid gap-1 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.4fr)_9.5rem] sm:items-center sm:gap-4">
              <p className="truncate text-sm font-medium">{item.actor}</p>
              <p className="truncate text-sm capitalize text-foreground">
                {item.action}
              </p>
              <p className="truncate text-sm text-muted">{item.entity}</p>
              <p className="text-xs text-muted sm:text-right">{item.timestamp}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
