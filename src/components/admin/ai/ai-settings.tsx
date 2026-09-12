import { fieldClass, labelClass } from "@/components/admin/ai/ai-common";
import { ActionForm, SubmitButton } from "@/components/admin/projects/action-form";
import { QueryStateNotice } from "@/components/admin/projects/query-state";
import {
  isTruthySetting,
  settingFieldSpec,
  type QueryResult,
} from "@/lib/admin-ai-constants";
import { saveAiSettings } from "@/lib/admin-ai-actions";
import type { AiSettingRow } from "@/types/database";

export function AiSettingsPanel({ result }: { result: QueryResult<AiSettingRow[]> }) {
  if (result.status === "error" || result.status === "unavailable") {
    return <QueryStateNotice result={result} />;
  }

  const rows = result.status === "empty" ? [] : result.data;
  if (rows.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-card-border bg-card p-10 text-center text-sm text-muted">
        No AI settings found in the database.
      </div>
    );
  }

  return (
    <ActionForm
      action={saveAiSettings}
      successMessage="AI settings saved."
      className="space-y-4"
    >
      {rows.map((row) => {
        const spec = settingFieldSpec(row.setting_key, row.setting_value);
        const value = row.setting_value ?? "";
        return (
          <section
            key={row.id}
            className="rounded-3xl border border-card-border bg-card p-5"
          >
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-lg text-foreground">{spec.label}</h3>
                <p className="mt-1 font-mono text-xs text-muted">{row.setting_key}</p>
                {row.description ? (
                  <p className="mt-2 text-sm text-muted">{row.description}</p>
                ) : null}
                {spec.help ? <p className="mt-2 text-sm text-muted">{spec.help}</p> : null}
              </div>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  name={`active_${row.id}`}
                  defaultChecked={row.is_active}
                  className="h-4 w-4 accent-foreground"
                />
                Enabled
              </label>
            </div>
            {spec.kind === "boolean" ? (
              <label className="flex items-center gap-2 text-sm">
                <input type="hidden" name={`value_${row.id}`} value="false" />
                <input
                  type="checkbox"
                  name={`value_${row.id}`}
                  value="true"
                  defaultChecked={isTruthySetting(value)}
                  className="h-4 w-4 accent-foreground"
                />
                On
              </label>
            ) : spec.kind === "select" && spec.options ? (
              <label className={labelClass}>
                <span className="sr-only">{spec.label}</span>
                <select
                  name={`value_${row.id}`}
                  defaultValue={value}
                  className={fieldClass}
                >
                  {value && !spec.options.includes(value) ? (
                    <option value={value}>{value}</option>
                  ) : null}
                  {spec.options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            ) : spec.kind === "textarea" ? (
              <textarea
                name={`value_${row.id}`}
                defaultValue={value}
                rows={5}
                className={fieldClass}
              />
            ) : (
              <input name={`value_${row.id}`} defaultValue={value} className={fieldClass} />
            )}
          </section>
        );
      })}
      <SubmitButton>Save settings</SubmitButton>
    </ActionForm>
  );
}
