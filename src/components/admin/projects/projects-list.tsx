import Link from "next/link";
import {
  clientDisplayName,
  formatDate,
  formatPriorityLabel,
  formatProjectBudget,
  formatStatusLabel,
  getPriorityStyle,
  getStatusStyle,
  type AdminProjectListItem,
} from "@/lib/admin-projects";
import { StatusPill } from "@/components/admin/projects/query-state";

export function ProjectsListTable({ projects }: { projects: AdminProjectListItem[] }) {
  return (
    <div className="overflow-x-auto rounded-3xl border border-card-border bg-card">
      <table className="w-full min-w-[52rem] text-left text-sm">
        <thead className="border-b border-card-border text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-4 py-3">Project</th>
            <th className="px-4 py-3">Title</th>
            <th className="px-4 py-3">Client</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Priority</th>
            <th className="px-4 py-3">Budget</th>
            <th className="px-4 py-3">Start</th>
            <th className="px-4 py-3">Due</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => (
            <tr
              key={project.id}
              className="border-b border-card-border/60 last:border-0 hover:bg-foreground/[0.02]"
            >
              <td className="px-4 py-3">
                <Link
                  href={`/admin/projects/${project.id}`}
                  className="font-medium text-foreground hover:underline"
                >
                  {project.project_number}
                </Link>
              </td>
              <td className="px-4 py-3 text-foreground">{project.title}</td>
              <td className="px-4 py-3">
                <div className="text-foreground">{clientDisplayName(project.client)}</div>
                {project.client?.company_name ? (
                  <div className="text-xs text-muted">{project.client.company_name}</div>
                ) : null}
              </td>
              <td className="px-4 py-3">
                <StatusPill
                  label={formatStatusLabel(project.status)}
                  className={getStatusStyle(project.status)}
                />
              </td>
              <td className="px-4 py-3">
                <StatusPill
                  label={formatPriorityLabel(project.priority)}
                  className={getPriorityStyle(project.priority)}
                />
              </td>
              <td className="px-4 py-3 text-muted">{formatProjectBudget(project)}</td>
              <td className="px-4 py-3 text-muted">{formatDate(project.start_date)}</td>
              <td className="px-4 py-3 text-muted">{formatDate(project.due_date)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
