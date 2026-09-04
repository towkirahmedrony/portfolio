import { asStringList, type QueryResult } from "@/lib/admin-projects";
import { upsertProjectRequirements } from "@/lib/admin-project-actions";
import type { ProjectRequirementRow } from "@/types/database";
import { ActionForm, SubmitButton } from "@/components/admin/projects/action-form";
import { AdminPanel, QueryStateNotice } from "@/components/admin/projects/query-state";

const fieldClass =
  "w-full rounded-xl border border-card-border bg-background px-3 py-2 text-sm text-foreground";

export function ProjectRequirementsTab({
  projectId,
  result,
}: {
  projectId: string;
  result: QueryResult<ProjectRequirementRow | null>;
}) {
  if (result.status === "error" || result.status === "unavailable") {
    return <QueryStateNotice result={result} />;
  }

  const requirement = result.status === "ok" ? result.data : null;

  return (
    <AdminPanel
      title="Requirements"
      description="Agreed scope from project_requirements. Features and services are stored as lists."
    >
      <ActionForm
        action={upsertProjectRequirements}
        className="grid gap-3"
        successMessage="Requirements saved."
      >
        <input type="hidden" name="projectId" value={projectId} />
        {requirement ? <input type="hidden" name="requirementId" value={requirement.id} /> : null}
        <label className="grid gap-1 text-sm">
          <span>Summary</span>
          <textarea name="summary" defaultValue={requirement?.summary ?? ""} rows={3} className={fieldClass} />
        </label>
        <label className="grid gap-1 text-sm">
          <span>Scope</span>
          <textarea name="scope" defaultValue={requirement?.scope ?? ""} rows={4} className={fieldClass} />
        </label>
        <label className="grid gap-1 text-sm">
          <span>Pages</span>
          <input
            name="pages"
            type="number"
            min={0}
            defaultValue={requirement?.pages ?? ""}
            className={fieldClass}
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span>Features (one per line)</span>
          <textarea
            name="features"
            defaultValue={asStringList(requirement?.features).join("\n")}
            rows={4}
            className={fieldClass}
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span>Design notes</span>
          <textarea
            name="design_notes"
            defaultValue={requirement?.design_notes ?? ""}
            rows={3}
            className={fieldClass}
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span>Technical notes</span>
          <textarea
            name="technical_notes"
            defaultValue={requirement?.technical_notes ?? ""}
            rows={3}
            className={fieldClass}
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span>Content notes</span>
          <textarea
            name="content_notes"
            defaultValue={requirement?.content_notes ?? ""}
            rows={3}
            className={fieldClass}
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span>Third-party services (one per line)</span>
          <textarea
            name="third_party_services"
            defaultValue={asStringList(requirement?.third_party_services).join("\n")}
            rows={3}
            className={fieldClass}
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span>Constraints</span>
          <textarea
            name="constraints"
            defaultValue={requirement?.constraints ?? ""}
            rows={3}
            className={fieldClass}
          />
        </label>
        <SubmitButton>{requirement ? "Update requirements" : "Create requirements"}</SubmitButton>
      </ActionForm>
    </AdminPanel>
  );
}
