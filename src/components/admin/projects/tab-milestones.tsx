import {
  formatDate,
  formatStatusLabel,
  MILESTONE_STATUSES,
  type QueryResult,
} from "@/lib/admin-projects";
import {
  createProjectMilestone,
  reorderProjectMilestone,
  updateProjectMilestone,
} from "@/lib/admin-project-actions";
import type { ProjectMilestoneRow } from "@/types/database";
import { ActionForm, SubmitButton } from "@/components/admin/projects/action-form";
import { AdminPanel, QueryStateNotice } from "@/components/admin/projects/query-state";

const fieldClass =
  "w-full rounded-xl border border-card-border bg-background px-3 py-2 text-sm text-foreground";

export function ProjectMilestonesTab({
  projectId,
  result,
}: {
  projectId: string;
  result: QueryResult<ProjectMilestoneRow[]>;
}) {
  if (result.status === "error" || result.status === "unavailable") {
    return <QueryStateNotice result={result} />;
  }

  const milestones = result.status === "empty" ? [] : result.data;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <AdminPanel title="Milestones" description="View, edit, change status, and reorder.">
        {milestones.length === 0 ? (
          <QueryStateNotice
            result={{ status: "empty", data: [] }}
            emptyMessage="No milestones yet."
          />
        ) : (
          <div className="space-y-4">
            {milestones.map((milestone, index) => (
              <article key={milestone.id} className="rounded-2xl border border-card-border p-4">
                <ActionForm
                  action={updateProjectMilestone}
                  className="grid gap-3"
                  successMessage="Milestone updated."
                >
                  <input type="hidden" name="projectId" value={projectId} />
                  <input type="hidden" name="milestoneId" value={milestone.id} />
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-muted">#{index + 1}</p>
                    <p className="text-xs text-muted">Due {formatDate(milestone.due_date)}</p>
                  </div>
                  <input name="title" defaultValue={milestone.title} required className={fieldClass} />
                  <textarea
                    name="description"
                    defaultValue={milestone.description ?? ""}
                    rows={2}
                    className={fieldClass}
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <select name="status" defaultValue={milestone.status} className={fieldClass}>
                      {MILESTONE_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {formatStatusLabel(status)}
                        </option>
                      ))}
                    </select>
                    <input
                      name="due_date"
                      type="date"
                      defaultValue={milestone.due_date ?? ""}
                      className={fieldClass}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <SubmitButton>Save</SubmitButton>
                  </div>
                </ActionForm>
                <div className="mt-3 flex gap-2">
                  <ActionForm action={reorderProjectMilestone}>
                    <input type="hidden" name="projectId" value={projectId} />
                    <input type="hidden" name="milestoneId" value={milestone.id} />
                    <input type="hidden" name="direction" value="up" />
                    <SubmitButton variant="secondary" className="px-2 py-1 text-xs">
                      Move up
                    </SubmitButton>
                  </ActionForm>
                  <ActionForm action={reorderProjectMilestone}>
                    <input type="hidden" name="projectId" value={projectId} />
                    <input type="hidden" name="milestoneId" value={milestone.id} />
                    <input type="hidden" name="direction" value="down" />
                    <SubmitButton variant="secondary" className="px-2 py-1 text-xs">
                      Move down
                    </SubmitButton>
                  </ActionForm>
                </div>
              </article>
            ))}
          </div>
        )}
      </AdminPanel>

      <AdminPanel title="Add milestone">
        <ActionForm
          action={createProjectMilestone}
          className="grid gap-3"
          successMessage="Milestone added."
        >
          <input type="hidden" name="projectId" value={projectId} />
          <input name="title" required placeholder="Title" className={fieldClass} />
          <textarea name="description" rows={3} placeholder="Description" className={fieldClass} />
          <select name="status" defaultValue="pending" className={fieldClass}>
            {MILESTONE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {formatStatusLabel(status)}
              </option>
            ))}
          </select>
          <input name="due_date" type="date" className={fieldClass} />
          <SubmitButton>Add milestone</SubmitButton>
        </ActionForm>
      </AdminPanel>
    </div>
  );
}
