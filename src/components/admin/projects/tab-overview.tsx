import {
  clientDisplayName,
  formatDate,
  formatPriorityLabel,
  formatProjectBudget,
  formatStatusLabel,
  getPriorityStyle,
  getStatusStyle,
  PROJECT_PRIORITIES,
  PROJECT_STATUSES,
  type AdminProjectListItem,
} from "@/lib/admin-projects";
import { updateProjectOverview } from "@/lib/admin-project-actions";
import { ActionForm, SubmitButton } from "@/components/admin/projects/action-form";
import { AdminPanel, StatusPill } from "@/components/admin/projects/query-state";

const fieldClass =
  "w-full rounded-xl border border-card-border bg-background px-3 py-2 text-sm text-foreground";

export function ProjectOverviewTab({ project }: { project: AdminProjectListItem }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <AdminPanel
        title="Overview"
        description="Core project fields from the projects table."
      >
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted">Project number</dt>
            <dd className="text-foreground">{project.project_number}</dd>
          </div>
          <div>
            <dt className="text-muted">Client</dt>
            <dd className="text-foreground">{clientDisplayName(project.client)}</dd>
            {project.client?.company_name ? (
              <dd className="text-xs text-muted">{project.client.company_name}</dd>
            ) : null}
          </div>
          <div>
            <dt className="text-muted">Status</dt>
            <dd className="mt-1">
              <StatusPill
                label={formatStatusLabel(project.status)}
                className={getStatusStyle(project.status)}
              />
            </dd>
          </div>
          <div>
            <dt className="text-muted">Priority</dt>
            <dd className="mt-1">
              <StatusPill
                label={formatPriorityLabel(project.priority)}
                className={getPriorityStyle(project.priority)}
              />
            </dd>
          </div>
          <div>
            <dt className="text-muted">Budget</dt>
            <dd className="text-foreground">{formatProjectBudget(project)}</dd>
          </div>
          <div>
            <dt className="text-muted">Timeline</dt>
            <dd className="text-foreground">
              {formatDate(project.start_date)} – {formatDate(project.due_date)}
            </dd>
          </div>
        </dl>
        {project.description ? (
          <div className="mt-4">
            <p className="text-sm text-muted">Description</p>
            <p className="mt-1 whitespace-pre-line text-sm text-foreground">
              {project.description}
            </p>
          </div>
        ) : null}
      </AdminPanel>

      <AdminPanel
        title="Edit project"
        description="Invalid status or priority values are rejected."
      >
        <ActionForm
          action={updateProjectOverview}
          className="grid gap-3"
          successMessage="Project updated."
        >
          <input type="hidden" name="projectId" value={project.id} />
          <label className="grid gap-1 text-sm">
            <span>Title</span>
            <input name="title" defaultValue={project.title} required className={fieldClass} />
          </label>
          <label className="grid gap-1 text-sm">
            <span>Description</span>
            <textarea
              name="description"
              defaultValue={project.description ?? ""}
              rows={4}
              className={fieldClass}
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span>Status</span>
            <select name="status" defaultValue={project.status} className={fieldClass}>
              {PROJECT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {formatStatusLabel(status)}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span>Priority</span>
            <select name="priority" defaultValue={project.priority} className={fieldClass}>
              {PROJECT_PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {formatPriorityLabel(priority)}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span>Estimated budget</span>
            <input
              name="estimated_budget"
              type="number"
              step="0.01"
              defaultValue={project.estimated_budget ?? ""}
              className={fieldClass}
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span>Agreed price</span>
            <input
              name="agreed_price"
              type="number"
              step="0.01"
              defaultValue={project.agreed_price ?? ""}
              className={fieldClass}
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span>Start date</span>
            <input
              name="start_date"
              type="date"
              defaultValue={project.start_date ?? ""}
              className={fieldClass}
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span>Due date</span>
            <input
              name="due_date"
              type="date"
              defaultValue={project.due_date ?? ""}
              className={fieldClass}
            />
          </label>
          <SubmitButton>Save changes</SubmitButton>
        </ActionForm>
      </AdminPanel>
    </div>
  );
}
