import Link from "next/link";
import { EmptyPanel, fieldClass, labelClass } from "@/components/admin/ai/ai-common";
import { DeleteActionForm, FlagToggle } from "@/components/admin/content/content-common";
import { ActionForm, SubmitButton } from "@/components/admin/projects/action-form";
import { QueryStateNotice } from "@/components/admin/projects/query-state";
import {
  AI_FAQ_CATEGORY_SUGGESTIONS,
  buildAdminAiHref,
  formatDate,
  formatKeywords,
  type AdminAiPageFilters,
  type QueryResult,
} from "@/lib/admin-ai-constants";
import { deleteAiFaq, saveAiFaq, setAiFaqActive } from "@/lib/admin-ai-actions";
import type { AiFaqRow } from "@/types/database";

function FaqForm({ item }: { item?: AiFaqRow | null }) {
  const isNew = !item;
  return (
    <ActionForm
      action={saveAiFaq}
      successMessage={isNew ? "FAQ created." : "FAQ updated."}
      className="rounded-3xl border border-card-border bg-card p-6"
    >
      {item ? <input type="hidden" name="id" value={item.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={`${labelClass} sm:col-span-2`}>
          <span>Question</span>
          <input name="question" defaultValue={item?.question ?? ""} required className={fieldClass} />
        </label>
        <label className={`${labelClass} sm:col-span-2`}>
          <span>Answer</span>
          <textarea
            name="answer"
            defaultValue={item?.answer ?? ""}
            required
            rows={6}
            className={fieldClass}
          />
        </label>
        <label className={labelClass}>
          <span>Category</span>
          <input
            name="category"
            defaultValue={item?.category ?? ""}
            list="ai-faq-categories"
            className={fieldClass}
          />
          <datalist id="ai-faq-categories">
            {AI_FAQ_CATEGORY_SUGGESTIONS.map((category) => (
              <option key={category} value={category} />
            ))}
          </datalist>
        </label>
        <label className={labelClass}>
          <span>Keywords</span>
          <input
            name="keywords"
            defaultValue={formatKeywords(item?.keywords)}
            placeholder="comma, separated, keywords"
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
        <SubmitButton>{isNew ? "Add FAQ" : "Save changes"}</SubmitButton>
        <Link
          href={buildAdminAiHref({ tab: "faqs" })}
          className="rounded-xl border border-card-border px-3 py-2 text-sm font-medium text-foreground"
        >
          Cancel
        </Link>
      </div>
    </ActionForm>
  );
}

export function AiFaqsPanel({
  result,
  filters,
}: {
  result: QueryResult<AiFaqRow[]>;
  filters: AdminAiPageFilters;
}) {
  if (result.status === "error" || result.status === "unavailable") {
    return <QueryStateNotice result={result} />;
  }

  const items = result.status === "empty" ? [] : result.data;
  const editing = filters.edit ? items.find((item) => item.id === filters.edit) : null;
  const showForm = filters.new === "1" || Boolean(editing);

  if (showForm) {
    return <FaqForm item={editing} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Link
          href={buildAdminAiHref({ tab: "faqs", new: "1" })}
          className="rounded-xl bg-foreground px-3 py-2 text-sm font-medium text-background"
        >
          Add FAQ
        </Link>
      </div>
      {items.length === 0 ? (
        <EmptyPanel
          message="No FAQs yet."
          actionHref={buildAdminAiHref({ tab: "faqs", new: "1" })}
          actionLabel="Add FAQ"
        />
      ) : (
        <div className="overflow-x-auto rounded-3xl border border-card-border bg-card">
          <table className="w-full min-w-[56rem] text-left text-sm">
            <thead className="border-b border-card-border text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Question</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Keywords</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Updated</th>
                <th className="px-4 py-3" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-card-border/60 last:border-0">
                  <td className="px-4 py-3 font-medium text-foreground">{item.question}</td>
                  <td className="px-4 py-3 text-muted">{item.category || "—"}</td>
                  <td className="max-w-xs truncate px-4 py-3 text-muted">
                    {formatKeywords(item.keywords) || "—"}
                  </td>
                  <td className="px-4 py-3">{item.priority}</td>
                  <td className="px-4 py-3">
                    <FlagToggle
                      action={setAiFaqActive}
                      hidden={{ id: item.id }}
                      active={item.is_active}
                      activeLabel="Active"
                      inactiveLabel="Inactive"
                      activeClass="border-transparent bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                      inactiveClass="border-card-border bg-background text-muted"
                    />
                  </td>
                  <td className="px-4 py-3 text-muted">{formatDate(item.updated_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={buildAdminAiHref({ tab: "faqs", edit: item.id })}
                        className="text-xs font-medium text-foreground underline-offset-2 hover:underline"
                      >
                        Edit
                      </Link>
                      <DeleteActionForm
                        action={deleteAiFaq}
                        hidden={{ id: item.id }}
                        confirmMessage={`Delete FAQ "${item.question}"?`}
                        label="Delete"
                        successMessage="FAQ deleted."
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
