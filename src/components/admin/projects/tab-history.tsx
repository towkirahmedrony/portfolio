import { AdminPanel, QueryStateNotice, StatusPill } from "@/components/admin/projects/query-state";
import {
  clientDisplayName,
  formatDateTime,
  formatStatusLabel,
  getStatusStyle,
  type ProjectClient,
  type QueryResult,
} from "@/lib/admin-projects";
import type { ProjectStatusHistoryRow } from "@/types/database";

type HistoryWithActor = ProjectStatusHistoryRow & { actor: ProjectClient | null };

export function ProjectHistoryTab({
  result,
}: {
  result: QueryResult<HistoryWithActor[]>;
}) {
  if (result.status === "unavailable") {
    return (
      <AdminPanel
        title="Status history"
        description="project_status_history is not available in the current database schema."
      >
        <QueryStateNotice result={result} />
        <p className="mt-3 text-sm text-muted">
          Status history is left unimplemented until that table is intentionally added.
        </p>
      </AdminPanel>
    );
  }

  if (result.status === "error") {
    return <QueryStateNotice result={result} />;
  }

  const history = result.status === "empty" ? [] : result.data;

  return (
    <AdminPanel
      title="Status history"
      description="Client-facing timeline from project_status_history."
    >
      {history.length === 0 ? (
        <QueryStateNotice
          result={{ status: "empty", data: [] }}
          emptyMessage="No status changes recorded yet."
        />
      ) : (
        <div className="relative ml-3 space-y-6 border-l border-card-border">
          {history.map((item) => (
            <div key={item.id} className="relative pl-6">
              <span className="absolute -left-1.5 top-1.5 h-3 w-3 rounded-full bg-accent ring-4 ring-card" />
              <div className="flex flex-wrap items-center gap-2">
                {item.from_status ? (
                  <StatusPill
                    label={formatStatusLabel(item.from_status)}
                    className={getStatusStyle(item.from_status)}
                  />
                ) : null}
                {item.from_status ? <span className="text-xs text-muted">to</span> : null}
                <StatusPill
                  label={formatStatusLabel(item.to_status)}
                  className={getStatusStyle(item.to_status)}
                />
              </div>
              {item.note ? <p className="mt-2 text-sm text-foreground">{item.note}</p> : null}
              <p className="mt-1 text-xs text-muted">
                {item.actor ? clientDisplayName(item.actor) : "System"} · {formatDateTime(item.created_at)}
              </p>
            </div>
          ))}
        </div>
      )}
    </AdminPanel>
  );
}
