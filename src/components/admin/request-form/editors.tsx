"use client";

import { useId, useState } from "react";
import { ActionForm, SubmitButton } from "@/components/admin/projects/action-form";
import {
  inputTypeLabel,
  isSelectableInputType,
  ORDER_FORM_INPUT_TYPES,
  usesPlaceholder,
} from "@/lib/admin-order-form-constants";
import {
  saveOrderFormField,
  saveOrderFormOption,
  saveOrderFormStep,
} from "@/lib/admin-order-form-actions";
import type {
  OrderFormFieldRow,
  OrderFormOptionRow,
  OrderFormStepRow,
} from "@/types/database";

const fieldClass =
  "w-full rounded-xl border border-card-border bg-background px-3 py-2 text-sm text-foreground";
const labelClass = "grid gap-1 text-sm";

function jsonValue(value: unknown): string {
  if (!value || (typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0)) {
    return "";
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "";
  }
}

function defaultValueText(value: unknown): string {
  if (value == null) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

export function StepEditor({
  step,
  onCancel,
}: {
  step?: OrderFormStepRow | null;
  onCancel?: () => void;
}) {
  const isNew = !step;

  return (
    <ActionForm
      action={saveOrderFormStep}
      successMessage={isNew ? "Step created." : "Step updated."}
      className="grid gap-3 rounded-2xl border border-card-border bg-background p-4"
    >
      {step ? <input type="hidden" name="id" value={step.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={labelClass}>
          <span>Title</span>
          <input name="title" defaultValue={step?.title ?? ""} required placeholder="Project type" className={fieldClass} />
        </label>
        <label className={labelClass}>
          <span>
            Key <span className="text-muted">(optional — auto from title)</span>
          </span>
          <input name="step_key" defaultValue={step?.step_key ?? ""} placeholder="project_type" className={fieldClass} />
        </label>
        <label className={`${labelClass} sm:col-span-2`}>
          <span>Description</span>
          <textarea
            name="description"
            defaultValue={step?.description ?? ""}
            rows={2}
            placeholder="Shown under the step title"
            className={fieldClass}
          />
        </label>
        {step ? (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="is_active" defaultChecked={step.is_active} />
            Active (visible on the public form)
          </label>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <SubmitButton>{isNew ? "Add step" : "Save step"}</SubmitButton>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-card-border px-3 py-2 text-sm text-muted hover:text-foreground"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </ActionForm>
  );
}

export function FieldEditor({
  field,
  stepId,
  optionGroups,
  onCancel,
}: {
  field?: OrderFormFieldRow | null;
  stepId: string;
  optionGroups: string[];
  onCancel?: () => void;
}) {
  const isNew = !field;
  const groupsListId = useId();
  const [inputType, setInputType] = useState(field?.input_type ?? "text");
  const selectable = isSelectableInputType(inputType);
  const showPlaceholder = usesPlaceholder(inputType);

  return (
    <ActionForm
      action={saveOrderFormField}
      successMessage={isNew ? "Field created." : "Field updated."}
      className="grid gap-3 rounded-2xl border border-card-border bg-background p-4"
    >
      {field ? <input type="hidden" name="id" value={field.id} /> : null}
      <input type="hidden" name="step_id" value={stepId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={labelClass}>
          <span>Label</span>
          <input name="label" defaultValue={field?.label ?? ""} required placeholder="Project type" className={fieldClass} />
        </label>
        <label className={labelClass}>
          <span>
            Name / key <span className="text-muted">(optional — auto from label)</span>
          </span>
          <input name="field_key" defaultValue={field?.field_key ?? ""} placeholder="project_type" className={fieldClass} />
        </label>
        <label className={labelClass}>
          <span>Type</span>
          <select
            name="input_type"
            value={inputType}
            onChange={(event) => setInputType(event.target.value)}
            className={fieldClass}
          >
            {ORDER_FORM_INPUT_TYPES.map((type) => (
              <option key={type} value={type}>
                {inputTypeLabel(type)}
              </option>
            ))}
          </select>
        </label>
        {showPlaceholder ? (
          <label className={labelClass}>
            <span>Placeholder</span>
            <input
              name="placeholder"
              defaultValue={field?.placeholder ?? ""}
              placeholder={inputType === "select" ? "Select an option" : "Shown inside the input"}
              className={fieldClass}
            />
          </label>
        ) : null}
        <label className={`${labelClass} sm:col-span-2`}>
          <span>Hint</span>
          <input name="hint" defaultValue={field?.hint ?? ""} placeholder="Optional helper text" className={fieldClass} />
        </label>
        {selectable ? (
          <label className={`${labelClass} sm:col-span-2`}>
            <span>Options group</span>
            <input
              name="options_group"
              defaultValue={field?.options_group ?? ""}
              placeholder="e.g. project_type"
              list={groupsListId}
              className={fieldClass}
            />
            {optionGroups.length > 0 ? (
              <datalist id={groupsListId}>
                {optionGroups.map((group) => (
                  <option key={group} value={group} />
                ))}
              </datalist>
            ) : null}
            <span className="text-xs text-muted">
              Selectable fields load choices from this group. Leave blank to create a group from the field key.
            </span>
          </label>
        ) : null}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="required" defaultChecked={field?.required ?? false} />
          Required
        </label>
        {field ? (
          <>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="visible" defaultChecked={field.visible} />
              Visible
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="is_active" defaultChecked={field.is_active} />
              Active
            </label>
          </>
        ) : null}
        <label className={`${labelClass} sm:col-span-2`}>
          <span>
            Default value <span className="text-muted">(optional)</span>
          </span>
          <input
            name="default_value"
            defaultValue={defaultValueText(field?.default_value)}
            placeholder='e.g. "yes" or ["contact"]'
            className={fieldClass}
          />
        </label>
        <details className="sm:col-span-2">
          <summary className="cursor-pointer text-sm text-muted">Advanced (conditional / constraints)</summary>
          <div className="mt-3 grid gap-3">
            <label className={labelClass}>
              <span>Conditional JSON</span>
              <textarea
                name="conditional"
                defaultValue={jsonValue(field?.conditional)}
                rows={3}
                placeholder='{"show_when":{"field":"has_design","equals":"yes"}}'
                className={`${fieldClass} font-mono text-xs`}
              />
            </label>
            <label className={labelClass}>
              <span>Constraints JSON</span>
              <textarea
                name="constraints"
                defaultValue={jsonValue(field?.constraints)}
                rows={3}
                placeholder='{"columns":2}'
                className={`${fieldClass} font-mono text-xs`}
              />
            </label>
          </div>
        </details>
      </div>
      <div className="flex flex-wrap gap-2">
        <SubmitButton>{isNew ? "Add field" : "Save field"}</SubmitButton>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-card-border px-3 py-2 text-sm text-muted hover:text-foreground"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </ActionForm>
  );
}

export function OptionEditor({
  option,
  group,
  onCancel,
}: {
  option?: OrderFormOptionRow | null;
  group: string;
  onCancel?: () => void;
}) {
  const isNew = !option;

  return (
    <ActionForm
      action={saveOrderFormOption}
      successMessage={isNew ? "Option created." : "Option updated."}
      className="grid gap-3 rounded-2xl border border-card-border bg-background p-4"
    >
      {option ? <input type="hidden" name="id" value={option.id} /> : null}
      <input type="hidden" name="group" value={option?.group ?? group} />
      <input type="hidden" name="meta" value={jsonValue(option?.meta)} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={labelClass}>
          <span>Label</span>
          <input name="label" defaultValue={option?.label ?? ""} required placeholder="Business website" className={fieldClass} />
        </label>
        <label className={labelClass}>
          <span>
            Value <span className="text-muted">(optional — auto from label)</span>
          </span>
          <input name="slug" defaultValue={option?.slug ?? ""} placeholder="business" className={fieldClass} />
        </label>
        <label className={`${labelClass} sm:col-span-2`}>
          <span>Description</span>
          <input
            name="description"
            defaultValue={option?.description ?? ""}
            placeholder="Optional extra text under the choice"
            className={fieldClass}
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="requires_text" defaultChecked={option?.requires_text ?? false} />
          Requires follow-up text
        </label>
        {option ? (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="is_active" defaultChecked={option.is_active} />
            Active
          </label>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <SubmitButton>{isNew ? "Add option" : "Save option"}</SubmitButton>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-card-border px-3 py-2 text-sm text-muted hover:text-foreground"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </ActionForm>
  );
}
