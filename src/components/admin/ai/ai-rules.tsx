import Link from "next/link";
import { ActiveBadge, EmptyPanel, fieldClass, labelClass } from "@/components/admin/ai/ai-common";
import { DeleteActionForm, FlagToggle } from "@/components/admin/content/content-common";
import { ActionForm, SubmitButton } from "@/components/admin/projects/action-form";
import { QueryStateNotice } from "@/components/admin/projects/query-state";
import {
  AI_RULE_TYPE_SUGGESTIONS,
  buildAdminAiHref,
  formatDate,
  type AdminAiPageFilters,
  type QueryResult,
} from "@/lib/admin-ai-constants";
import { deleteAiRule, saveAiRule, setAiRuleActive } from "@/lib/admin-ai-actions";
import type { AiRuleRow } from "@/types/database";

function RuleForm({ item }: { item?: AiRuleRow | null }) {
  const isNew = !item;
  return (
    <ActionForm
      action={saveAiRule}
      successMessage={isNew ? "Rule created." : "Rule updated."}
      className="rounded-3xl border border-card-border bg-card p-6"
    >
      {item ? <input type="hidden" name="id" value={item.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          <span>Name</span>
          <input name="name" defaultValue={item?.name ?? ""} required className={fieldClass} />
        </label>
        <label className={labelClass}>
          <span>Rule type</span>
          <input
            name="rule_type"
            defaultValue={item?.rule_type ?? ""}
            required
            list="ai-rule-types"
            className={fieldClass}
          />
          <datalist id="ai-rule-types">
            {AI_RULE_TYPE_SUGGESTIONS.map((type) => (
              <option key={type} value={type} />
            ))}
          </datalist>
        </label>
        <label className={`${labelClass} sm:col-span-2`}>
          <span>Instruction</span>
          <textarea
            name="instruction"
            defaultValue={item?.instruction ?? ""}
            required
            rows={8}
            className={fieldClass}
          />
        </label>
        <label className={labelClass}>
          <span>Priority</span>
          <input
            name="priority"
            type="number"
            step="1"
            required
            defaultValue={item?.priority ?? 0}
            className={fieldClass}
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            name="is_active"
            defaultChecked={item?.is_active ?? true}
            className="h-4 w-4 accent-foreground"
          />
          Active
        </label>
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        <SubmitButton>{isNew ? "Add rule" : "Save changes"}</SubmitButton>
        <Link
          href={buildAdminAiHref({ tab: "rules" })}
          className="rounded-xl border border-card-border px-3 py-2 text-sm font-medium text-foreground"
        >
          Cancel
        </Link>
      </div>
    </ActionForm>
  );
}

export function AiRulesPanel({
  result,
  filters,
}: {
  result: QueryResult<AiRuleRow[]>;
  filters: AdminAiPageFilters;
}) {
  if (result.status === "error" || result.status === "unavailable") {
    return <QueryStateNotice result={result} />;
  }

  const items = result.status === "empty" ? [] : result.data;
  const editing = filters.edit ? items.find((item) => item.id === filters.edit) : null;
  const showForm = filters.new === "1" || Boolean(editing);

  if (showForm) {
    return <RuleForm item={editing} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Link
          href={buildAdminAiHref({ tab: "rules", new: "1" })}
          className="rounded-xl bg-foreground px-3 py-2 text-sm font-medium text-background"
        >
          Add rule
        </Link>
      </div>
      {items.length === 0 ? (
        <EmptyPanel
          message="No AI rules yet."
          actionHref={buildAdminAiHref({ tab: "rules", new: "1" })}
          actionLabel="Add rule"
        />
      ) : (
        <div className="overflow-x-auto rounded-3xl border border-card-border bg-card">
          <table className="w-full min-w-[56rem] text-left text-sm">
            <thead className="border-b border-card-border text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Instruction</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Updated</th>
                <th className="px-4 py-3" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-card-border/60 last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{item.name}</div>
                    <div className="mt-1">
                      <ActiveBadge active={item.is_active} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted">{item.rule_type}</td>
                  <td className="max-w-sm truncate px-4 py-3 text-muted">{item.instruction}</td>
                  <td className="px-4 py-3">{item.priority}</td>
                  <td className="px-4 py-3 text-muted">{formatDate(item.created_at)}</td>
                  <td className="px-4 py-3 text-muted">{formatDate(item.updated_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <FlagToggle
                        action={setAiRuleActive}
                        hidden={{ id: item.id }}
                        active={item.is_active}
                        activeLabel="Active"
                        inactiveLabel="Inactive"
                        activeClass="border-transparent bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                        inactiveClass="border-card-border bg-background text-muted"
                      />
                      <Link
                        href={buildAdminAiHref({ tab: "rules", edit: item.id })}
                        className="text-xs font-medium text-foreground underline-offset-2 hover:underline"
                      >
                        Edit
                      </Link>
                      <DeleteActionForm
                        action={deleteAiRule}
                        hidden={{ id: item.id }}
                        confirmMessage={`Delete rule "${item.name}"?`}
                        label="Delete"
                        successMessage="Rule deleted."
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
