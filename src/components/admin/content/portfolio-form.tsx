import { PhotoUploadField } from "@/components/admin/photo-upload-field";
import { ActionForm, SubmitButton } from "@/components/admin/projects/action-form";
import { savePortfolioProject, savePortfolioThumbnail } from "@/lib/admin-content-actions";
import { PORTFOLIO_CATEGORY_SUGGESTIONS } from "@/lib/admin-content-constants";
import type { PortfolioProjectRow } from "@/types/database";

const fieldClass =
  "w-full rounded-xl border border-card-border bg-background px-3 py-2 text-sm text-foreground";
const labelClass = "grid gap-1 text-sm";
const inputLabel = "text-sm text-foreground";

export function PortfolioProjectForm({
  project,
  isNew,
}: {
  project?: PortfolioProjectRow | null;
  isNew: boolean;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <ActionForm
        action={savePortfolioProject}
        successMessage={isNew ? "Project created." : "Project updated."}
        className="rounded-3xl border border-card-border bg-card p-6"
      >
        {project ? <input type="hidden" name="id" value={project.id} /> : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelClass}>
            <span className={inputLabel}>Title</span>
            <input
              name="title"
              defaultValue={project?.title ?? ""}
              required
              placeholder="Acme redesign"
              className={fieldClass}
            />
          </label>
          <label className={labelClass}>
            <span className={inputLabel}>
              Slug <span className="text-muted">(optional — auto from title)</span>
            </span>
            <input
              name="slug"
              defaultValue={project?.slug ?? ""}
              placeholder="acme-redesign"
              className={fieldClass}
            />
          </label>
          <label className={`${labelClass} sm:col-span-2`}>
            <span className={inputLabel}>Short description</span>
            <input
              name="short_description"
              defaultValue={project?.short_description ?? ""}
              placeholder="One-line summary shown in cards"
              className={fieldClass}
            />
          </label>
          <label className={`${labelClass} sm:col-span-2`}>
            <span className={inputLabel}>Description</span>
            <textarea
              name="description"
              defaultValue={project?.description ?? ""}
              rows={6}
              className={fieldClass}
            />
          </label>
          <label className={labelClass}>
            <span className={inputLabel}>Category</span>
            <input
              name="category"
              defaultValue={project?.category ?? ""}
              list="portfolio-categories"
              className={fieldClass}
            />
            <datalist id="portfolio-categories">
              {PORTFOLIO_CATEGORY_SUGGESTIONS.map((category) => (
                <option key={category} value={category} />
              ))}
            </datalist>
          </label>
          <label className={labelClass}>
            <span className={inputLabel}>
              Technologies <span className="text-muted">(one per line)</span>
            </span>
            <textarea
              name="technologies"
              defaultValue={(project?.technologies ?? []).join("\n")}
              rows={3}
              className={fieldClass}
            />
          </label>
          <label className={labelClass}>
            <span className={inputLabel}>Live URL</span>
            <input
              name="live_url"
              type="url"
              defaultValue={project?.live_url ?? ""}
              placeholder="https://example.com"
              className={fieldClass}
            />
          </label>
          <label className={labelClass}>
            <span className={inputLabel}>GitHub URL</span>
            <input
              name="github_url"
              type="url"
              defaultValue={project?.github_url ?? ""}
              placeholder="https://github.com/…"
              className={fieldClass}
            />
          </label>
          <PhotoUploadField
            folder="portfolio"
            entityId={project?.id}
            name="thumbnail_url"
            currentUrl={project?.thumbnail_url}
            label="Thumbnail"
            hint="Upload from your gallery or files. The URL is saved automatically."
            persist={project ? savePortfolioThumbnail.bind(null, project.id) : undefined}
          />
        </div>

        <div className="mt-5 grid gap-4 rounded-2xl border border-card-border bg-background p-4 sm:grid-cols-3">
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              name="featured"
              defaultChecked={project?.featured ?? false}
              className="h-4 w-4 accent-foreground"
            />
            Featured
          </label>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              name="published"
              defaultChecked={project?.published ?? false}
              className="h-4 w-4 accent-foreground"
            />
            Published
          </label>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <span className="text-muted">Sort order</span>
            <input
              name="sort_order"
              type="number"
              step="1"
              defaultValue={project?.sort_order ?? 0}
              className={`${fieldClass} w-24`}
            />
          </label>
        </div>

        <div className="mt-6">
          <SubmitButton>{isNew ? "Create project" : "Save changes"}</SubmitButton>
        </div>
      </ActionForm>
    </div>
  );
}
