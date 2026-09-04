import Link from "next/link";
import {
  clientDisplayName,
  formatDate,
  formatPriorityLabel,
  formatProjectBudget,
  formatStatusLabel,
  getPriorityStyle,
  getStatusStyle,
  PROJECT_STATUSES,
  type AdminProjectListItem,
} from "@/lib/admin-projects";
import { StatusPill } from "@/components/admin/projects/query-state";

export function ProjectsKanban({ projects }: { projects: AdminProjectListItem[] }) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {PROJECT_STATUSES.map((status) => {
        const column = projects.filter((project) => project.status === status);
        return (
          <section
            key={status}
            className="flex w-72 shrink-0 flex-col rounded-3xl border border-card-border bg-card"
          >
            <header className="flex items-center justify-between border-b border-card-border px-4 py-3">
              <h3 className="text-sm font-medium text-foreground">
                {formatStatusLabel(status)}
              </h3>
              <span className="text-xs text-muted">{column.length}</span>
            </header>
            <div className="flex flex-1 flex-col gap-3 p-3">
              {column.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-card-border px-3 py-6 text-center text-xs text-muted">
                  No projects
                </p>
              ) : (
                column.map((project) => (
                  <Link
                    key={project.id}
                    href={`/admin/projects/${project.id}`}
                    className="rounded-2xl border border-card-border bg-background p-3 transition-colors hover:border-foreground/20"
                  >
                    <p className="text-[11px] font-semibold tracking-wider text-muted uppercase">
                      {project.project_number}
                    </p>
                    <p className="mt-1 text-sm font-medium text-foreground">{project.title}</p>
                    <p className="mt-1 text-xs text-muted">{clientDisplayName(project.client)}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <StatusPill
                        label={formatPriorityLabel(project.priority)}
                        className={getPriorityStyle(project.priority)}
                      />
                      <StatusPill
                        label={formatStatusLabel(project.status)}
                        className={getStatusStyle(project.status)}
                      />
                    </div>
                    <div className="mt-3 space-y-1 text-xs text-muted">
                      <p>Budget: {formatProjectBudget(project)}</p>
                      <p>Start: {formatDate(project.start_date)}</p>
                      <p>Due: {formatDate(project.due_date)}</p>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
