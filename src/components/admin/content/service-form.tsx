import { PhotoUploadField } from "@/components/admin/photo-upload-field";
import { ActionForm, SubmitButton } from "@/components/admin/projects/action-form";
import { saveService, saveServiceImage } from "@/lib/admin-content-actions";
import type { ServiceRow } from "@/types/database";

const fieldClass =
  "w-full rounded-xl border border-card-border bg-background px-3 py-2 text-sm text-foreground";
const labelClass = "grid gap-1 text-sm";
const inputLabel = "text-sm text-foreground";

export function ServiceForm({
  service,
  isNew,
}: {
  service?: ServiceRow | null;
  isNew: boolean;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <ActionForm
        action={saveService}
        successMessage={isNew ? "Service created." : "Service updated."}
        className="rounded-3xl border border-card-border bg-card p-6"
      >
        {service ? <input type="hidden" name="id" value={service.id} /> : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelClass}>
            <span className={inputLabel}>Name</span>
            <input
              name="name"
              defaultValue={service?.name ?? ""}
              required
              placeholder="Web design"
              className={fieldClass}
            />
          </label>
          <label className={labelClass}>
            <span className={inputLabel}>
              Slug <span className="text-muted">(optional — auto from name)</span>
            </span>
            <input
              name="slug"
              defaultValue={service?.slug ?? ""}
              placeholder="web-design"
              className={fieldClass}
            />
          </label>
          <label className={`${labelClass} sm:col-span-2`}>
            <span className={inputLabel}>Short description</span>
            <input
              name="short_description"
              defaultValue={service?.short_description ?? ""}
              placeholder="One-line summary shown on the services page"
              className={fieldClass}
            />
          </label>
          <label className={`${labelClass} sm:col-span-2`}>
            <span className={inputLabel}>Description</span>
            <textarea
              name="description"
              defaultValue={service?.description ?? ""}
              rows={5}
              className={fieldClass}
            />
          </label>
          <label className={labelClass}>
            <span className={inputLabel}>Starting price</span>
            <input
              name="starting_price"
              type="number"
              inputMode="decimal"
              step="0.01"
              min={0}
              defaultValue={service?.starting_price ?? ""}
              placeholder="e.g. 25000"
              className={fieldClass}
            />
          </label>
          <label className={labelClass}>
            <span className={inputLabel}>Currency</span>
            <input
              name="currency"
              defaultValue={service?.currency ?? "BDT"}
              maxLength={8}
              className={fieldClass}
            />
          </label>
          <label className={labelClass}>
            <span className={inputLabel}>Estimated days (min)</span>
            <input
              name="estimated_days_min"
              type="number"
              inputMode="numeric"
              step="1"
              min={0}
              defaultValue={service?.estimated_days_min ?? ""}
              placeholder="e.g. 7"
              className={fieldClass}
            />
          </label>
          <PhotoUploadField
            folder="services"
            entityId={service?.id}
            name="image_url"
            currentUrl={service?.image_url}
            label="Service photo"
            hint="Upload from your gallery or files. The URL is saved automatically."
            persist={service ? saveServiceImage.bind(null, service.id) : undefined}
          />
          <label className={labelClass}>
            <span className={inputLabel}>Estimated days (max)</span>
            <input
              name="estimated_days_max"
              type="number"
              inputMode="numeric"
              step="1"
              min={0}
              defaultValue={service?.estimated_days_max ?? ""}
              placeholder="e.g. 14"
              className={fieldClass}
            />
          </label>
        </div>

        <div className="mt-5 grid gap-4 rounded-2xl border border-card-border bg-background p-4 sm:grid-cols-3">
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              name="published"
              defaultChecked={service?.published ?? false}
              className="h-4 w-4 accent-foreground"
            />
            Published
          </label>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              name="featured"
              defaultChecked={service?.featured ?? false}
              className="h-4 w-4 accent-foreground"
            />
            Featured
          </label>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <span className="text-muted">Sort order</span>
            <input
              name="sort_order"
              type="number"
              step="1"
              defaultValue={service?.sort_order ?? 0}
              className={`${fieldClass} w-24`}
            />
          </label>
        </div>

        <div className="mt-6">
          <SubmitButton>{isNew ? "Create service" : "Save changes"}</SubmitButton>
        </div>
      </ActionForm>
    </div>
  );
}
