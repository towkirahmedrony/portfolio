"use client";

import { useState } from "react";
import { DeleteActionForm, FlagToggle, ReorderForm } from "@/components/admin/content/content-common";
import { FieldEditor, OptionEditor, StepEditor } from "@/components/admin/request-form/editors";
import { StatusPill } from "@/components/admin/projects/query-state";
import {
  inputTypeLabel,
  isSelectableInputType,
  type AdminOrderFormField,
  type AdminOrderFormOption,
  type AdminOrderFormStep,
  type AdminOrderFormTree,
} from "@/lib/admin-order-form-constants";
import {
  deleteOrderFormField,
  deleteOrderFormOption,
  deleteOrderFormStep,
  reorderOrderFormField,
  reorderOrderFormOption,
  reorderOrderFormStep,
  setOrderFormFieldActive,
  setOrderFormOptionActive,
  setOrderFormStepActive,
} from "@/lib/admin-order-form-actions";

type EditorTarget =
  | { kind: "step"; id?: string }
  | { kind: "field"; stepId: string; id?: string }
  | { kind: "option"; group: string; id?: string };

function isOpen(target: EditorTarget | null, next: EditorTarget): boolean {
  if (!target) {
    return false;
  }
  return (
    target.kind === next.kind &&
    ("id" in target ? target.id : undefined) === ("id" in next ? next.id : undefined) &&
    ("stepId" in target ? target.stepId : undefined) === ("stepId" in next ? next.stepId : undefined) &&
    ("group" in target ? target.group : undefined) === ("group" in next ? next.group : undefined)
  );
}

function VisibilityPill({ active }: { active: boolean }) {
  return active ? (
    <StatusPill
      label="Active"
      className="border-transparent bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
    />
  ) : (
    <StatusPill label="Hidden" className="border-card-border bg-background text-muted" />
  );
}

function OptionList({
  options,
  group,
  editor,
  setEditor,
}: {
  options: AdminOrderFormOption[];
  group: string;
  editor: EditorTarget | null;
  setEditor: (target: EditorTarget | null) => void;
}) {
  return (
    <div className="ml-4 space-y-2 border-l border-card-border pl-4">
      {options.map((option, index) => {
        const editing = isOpen(editor, { kind: "option", group, id: option.id });
        return (
          <div key={option.id} className="rounded-2xl border border-card-border/70 bg-background p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">{option.label}</p>
                <p className="font-mono text-xs text-muted">{option.slug}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <VisibilityPill active={option.is_active} />
                <span className="text-xs text-muted">{option.sort_order}</span>
                <ReorderForm
                  action={reorderOrderFormOption}
                  hidden={{ optionId: option.id, group: option.group }}
                  direction="up"
                  disabled={index === 0}
                  label={`Move ${option.label} up`}
                />
                <ReorderForm
                  action={reorderOrderFormOption}
                  hidden={{ optionId: option.id, group: option.group }}
                  direction="down"
                  disabled={index === options.length - 1}
                  label={`Move ${option.label} down`}
                />
                <FlagToggle
                  action={setOrderFormOptionActive}
                  hidden={{ optionId: option.id }}
                  active={option.is_active}
                  activeLabel="Shown"
                  inactiveLabel="Hidden"
                  activeClass="border-transparent bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  inactiveClass="border-card-border bg-background text-muted"
                />
                <button
                  type="button"
                  onClick={() => setEditor(editing ? null : { kind: "option", group, id: option.id })}
                  className="text-xs font-medium text-foreground underline-offset-2 hover:underline"
                >
                  {editing ? "Close" : "Edit"}
                </button>
                <DeleteActionForm
                  action={deleteOrderFormOption}
                  hidden={{ optionId: option.id }}
                  confirmMessage={`Delete option "${option.label}"? Existing submitted requests keep their snapshots. Prefer Hide for the public form.`}
                  label="Delete"
                  successMessage="Option deleted."
                />
              </div>
            </div>
            {editing ? (
              <div className="mt-3">
                <OptionEditor option={option} group={group} onCancel={() => setEditor(null)} />
              </div>
            ) : null}
          </div>
        );
      })}
      {isOpen(editor, { kind: "option", group }) ? (
        <OptionEditor group={group} onCancel={() => setEditor(null)} />
      ) : (
        <button
          type="button"
          onClick={() => setEditor({ kind: "option", group })}
          className="text-xs font-medium text-foreground underline-offset-2 hover:underline"
        >
          + Add Option
        </button>
      )}
    </div>
  );
}

function FieldCard({
  field,
  index,
  total,
  optionGroups,
  editor,
  setEditor,
}: {
  field: AdminOrderFormField;
  index: number;
  total: number;
  optionGroups: string[];
  editor: EditorTarget | null;
  setEditor: (target: EditorTarget | null) => void;
}) {
  const editing = isOpen(editor, { kind: "field", stepId: field.step_id, id: field.id });
  const selectable = isSelectableInputType(field.input_type);
  const group = field.options_group ?? field.field_key;

  return (
    <div className="rounded-2xl border border-card-border bg-card/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">{field.label}</p>
          <p className="mt-1 text-xs text-muted">
            <span className="font-mono">{field.field_key}</span>
            {" · "}
            {inputTypeLabel(field.input_type)}
            {" · "}
            {field.required ? "Required" : "Optional"}
            {field.placeholder ? ` · ${field.placeholder}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <VisibilityPill active={field.is_active} />
          <span className="text-xs text-muted">{field.sort_order}</span>
          <ReorderForm
            action={reorderOrderFormField}
            hidden={{ fieldId: field.id, stepId: field.step_id }}
            direction="up"
            disabled={index === 0}
            label={`Move ${field.label} up`}
          />
          <ReorderForm
            action={reorderOrderFormField}
            hidden={{ fieldId: field.id, stepId: field.step_id }}
            direction="down"
            disabled={index === total - 1}
            label={`Move ${field.label} down`}
          />
          <FlagToggle
            action={setOrderFormFieldActive}
            hidden={{ fieldId: field.id }}
            active={field.is_active}
            activeLabel="Shown"
            inactiveLabel="Hidden"
            activeClass="border-transparent bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
            inactiveClass="border-card-border bg-background text-muted"
          />
          <button
            type="button"
            onClick={() =>
              setEditor(editing ? null : { kind: "field", stepId: field.step_id, id: field.id })
            }
            className="text-xs font-medium text-foreground underline-offset-2 hover:underline"
          >
            {editing ? "Close" : "Edit"}
          </button>
          <DeleteActionForm
            action={deleteOrderFormField}
            hidden={{ fieldId: field.id }}
            confirmMessage={`Delete field "${field.label}"? Existing submitted requests keep their snapshots. Prefer Hide so new submissions skip it.`}
            label="Delete"
            successMessage="Field deleted."
          />
        </div>
      </div>
      {editing ? (
        <div className="mt-3">
          <FieldEditor
            field={field}
            stepId={field.step_id}
            optionGroups={optionGroups}
            onCancel={() => setEditor(null)}
          />
        </div>
      ) : null}
      {selectable ? (
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">
            Options{field.options_group ? ` · ${field.options_group}` : ""}
          </p>
          {!field.options_group ? (
            <p className="mb-2 text-xs text-muted">
              No options group is set. Radio fields without a group use built-in Yes/No on the public form. Edit the field to attach a group, or add options here to create one named after the field key.
            </p>
          ) : null}
          <OptionList options={field.options} group={group} editor={editor} setEditor={setEditor} />
        </div>
      ) : null}
    </div>
  );
}

function StepCard({
  step,
  index,
  total,
  optionGroups,
  editor,
  setEditor,
}: {
  step: AdminOrderFormStep;
  index: number;
  total: number;
  optionGroups: string[];
  editor: EditorTarget | null;
  setEditor: (target: EditorTarget | null) => void;
}) {
  const editing = isOpen(editor, { kind: "step", id: step.id });
  const addingField = isOpen(editor, { kind: "field", stepId: step.id });

  return (
    <details open className="rounded-3xl border border-card-border bg-card p-5">
      <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <h3 className="font-display text-lg text-foreground">{step.title}</h3>
        <p className="mt-1 text-sm text-muted">
          {step.description || "No description"}
          {" · "}
          {step.fields.length} field{step.fields.length === 1 ? "" : "s"}
          {" · "}
          <span className="font-mono text-xs">{step.step_key}</span>
        </p>
      </summary>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <VisibilityPill active={step.is_active} />
        <span className="text-xs text-muted">Order {step.sort_order}</span>
        <ReorderForm
          action={reorderOrderFormStep}
          hidden={{ stepId: step.id }}
          direction="up"
          disabled={index === 0}
          label={`Move ${step.title} up`}
        />
        <ReorderForm
          action={reorderOrderFormStep}
          hidden={{ stepId: step.id }}
          direction="down"
          disabled={index === total - 1}
          label={`Move ${step.title} down`}
        />
        <FlagToggle
          action={setOrderFormStepActive}
          hidden={{ stepId: step.id }}
          active={step.is_active}
          activeLabel="Shown"
          inactiveLabel="Hidden"
          activeClass="border-transparent bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
          inactiveClass="border-card-border bg-background text-muted"
        />
        <button
          type="button"
          onClick={() => setEditor(editing ? null : { kind: "step", id: step.id })}
          className="text-xs font-medium text-foreground underline-offset-2 hover:underline"
        >
          {editing ? "Close" : "Edit"}
        </button>
        <DeleteActionForm
          action={deleteOrderFormStep}
          hidden={{ stepId: step.id }}
          confirmMessage={`Delete step "${step.title}"? Hide it instead if it still has fields. Existing submitted requests keep their snapshots.`}
          label="Delete"
          successMessage="Step deleted."
        />
      </div>

      <div className="mt-5 space-y-3">
        {editing ? <StepEditor step={step} onCancel={() => setEditor(null)} /> : null}
        {step.fields.map((field, fieldIndex) => (
          <FieldCard
            key={field.id}
            field={field}
            index={fieldIndex}
            total={step.fields.length}
            optionGroups={optionGroups}
            editor={editor}
            setEditor={setEditor}
          />
        ))}
        {addingField ? (
          <FieldEditor stepId={step.id} optionGroups={optionGroups} onCancel={() => setEditor(null)} />
        ) : (
          <button
            type="button"
            onClick={() => setEditor({ kind: "field", stepId: step.id })}
            className="rounded-xl border border-dashed border-card-border px-3 py-2 text-sm font-medium text-foreground hover:border-foreground"
          >
            + Add Field
          </button>
        )}
      </div>
    </details>
  );
}

export function RequestFormBuilder({ tree }: { tree: AdminOrderFormTree }) {
  const [editor, setEditor] = useState<EditorTarget | null>(null);
  const optionGroups = Array.from(
    new Set([
      ...tree.steps.flatMap((step) =>
        step.fields.flatMap((field) => [
          field.options_group,
          ...field.options.map((option) => option.group),
        ]),
      ),
      ...tree.ungroupedOptions.map((option) => option.group),
    ].filter((group): group is string => Boolean(group))),
  );
  const addingStep = isOpen(editor, { kind: "step" });

  return (
    <div className="space-y-4">
      <p className="rounded-3xl border border-card-border bg-card p-4 text-sm text-muted">
        Hide/Show is the preferred way to remove something from new submissions. Deleting configuration never
        changes historical project requests or their form snapshots, and it never creates projects or quotes.
      </p>

      {tree.steps.map((step, index) => (
        <StepCard
          key={step.id}
          step={step}
          index={index}
          total={tree.steps.length}
          optionGroups={optionGroups}
          editor={editor}
          setEditor={setEditor}
        />
      ))}

      {addingStep ? (
        <StepEditor onCancel={() => setEditor(null)} />
      ) : (
        <button
          type="button"
          onClick={() => setEditor({ kind: "step" })}
          className="rounded-xl bg-foreground px-3 py-2 text-sm font-medium text-background"
        >
          + Add Step
        </button>
      )}

      {tree.ungroupedOptions.length > 0 ? (
        <section className="rounded-3xl border border-dashed border-card-border bg-card p-5">
          <h3 className="font-display text-lg text-foreground">Unused option groups</h3>
          <p className="mt-1 mb-4 text-sm text-muted">
            These choices are not attached to a selectable field. Assign their group on a field, or delete them.
          </p>
          {Array.from(new Set(tree.ungroupedOptions.map((option) => option.group))).map((group) => (
            <div key={group} className="mb-4 last:mb-0">
              <p className="mb-2 font-mono text-xs text-muted">{group}</p>
              <OptionList
                options={tree.ungroupedOptions.filter((option) => option.group === group)}
                group={group}
                editor={editor}
                setEditor={setEditor}
              />
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}
