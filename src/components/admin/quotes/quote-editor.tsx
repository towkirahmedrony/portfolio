"use client";

import { useMemo, useState } from "react";
import { ActionForm, SubmitButton } from "@/components/admin/projects/action-form";
import { AdminPanel } from "@/components/admin/projects/query-state";
import { clientDisplayName } from "@/lib/admin-project-constants";
import type { QuoteProjectOption } from "@/lib/admin-quote-constants";
import { saveQuoteDraft } from "@/lib/admin-quote-actions";
import {
  calculateQuoteFinancials,
  formatMoney,
  lineAmount,
  roundMoney,
} from "@/lib/quote-money";
import type { QuoteItemRow, QuoteRow } from "@/types/database";

type EditorLine = {
  key: string;
  description: string;
  quantity: string;
  unit_price: string;
};

const fieldClass =
  "w-full rounded-xl border border-card-border bg-background px-3 py-2 text-sm text-foreground";

function toDatetimeLocal(value: string | null | undefined): string {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function emptyLine(): EditorLine {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    description: "",
    quantity: "1",
    unit_price: "0",
  };
}

function fromQuoteItems(items: QuoteItemRow[]): EditorLine[] {
  if (items.length === 0) {
    return [emptyLine()];
  }

  return items.map((item) => ({
    key: item.id,
    description: item.description,
    quantity: String(item.quantity),
    unit_price: String(item.unit_price),
  }));
}

export function QuoteEditor({
  quote,
  items = [],
  projects,
  readOnly = false,
}: {
  quote?: QuoteRow;
  items?: QuoteItemRow[];
  projects: QuoteProjectOption[];
  readOnly?: boolean;
}) {
  const [projectId, setProjectId] = useState(quote?.project_id ?? "");
  const [lines, setLines] = useState<EditorLine[]>(() => fromQuoteItems(items));
  const [discount, setDiscount] = useState(String(quote?.discount_total ?? 0));
  const [tax, setTax] = useState(String(quote?.tax_total ?? 0));
  const [notes, setNotes] = useState(quote?.notes ?? "");
  const [terms, setTerms] = useState(quote?.terms ?? "");
  const [validUntil, setValidUntil] = useState(toDatetimeLocal(quote?.valid_until));

  const selectedProject = projects.find((project) => project.id === projectId) ?? null;
  const currency = quote?.currency || selectedProject?.currency || "BDT";

  const calculation = useMemo(() => {
    const parsedLines = lines.map((line) => ({
      description: line.description,
      quantity: Number(line.quantity),
      unit_price: Number(line.unit_price),
    }));
    return calculateQuoteFinancials(parsedLines, Number(discount) || 0, Number(tax) || 0);
  }, [lines, discount, tax]);

  function updateLine(key: string, patch: Partial<EditorLine>) {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  }

  function addLine() {
    setLines((current) => [...current, emptyLine()]);
  }

  function removeLine(key: string) {
    setLines((current) => (current.length <= 1 ? current : current.filter((line) => line.key !== key)));
  }

  const totals = calculation.ok
    ? calculation.totals
    : {
        subtotal: 0,
        discount_total: roundMoney(Number(discount) || 0),
        tax_total: roundMoney(Number(tax) || 0),
        total: 0,
      };

  return (
    <ActionForm action={saveQuoteDraft} className="grid gap-6" successMessage="Draft saved.">
      <fieldset disabled={readOnly} className="grid gap-6">
      {quote ? <input type="hidden" name="quoteId" value={quote.id} /> : null}
      <input type="hidden" name="subtotal" value={totals.subtotal} />
      <input type="hidden" name="total" value={totals.total} />

      <AdminPanel
        title={quote ? `Quote v${quote.version}` : "New quote"}
        description="Line amounts, subtotal, discount, tax, and total are calculated before save."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm">
            <span className="font-medium">Project</span>
            {quote ? (
              <>
                <input type="hidden" name="projectId" value={quote.project_id} />
                <div className="rounded-xl border border-card-border bg-background px-3 py-2 text-foreground">
                  {selectedProject
                    ? `${selectedProject.project_number} · ${selectedProject.title}`
                    : quote.project_id}
                </div>
              </>
            ) : (
              <select
                name="projectId"
                required
                value={projectId}
                onChange={(event) => setProjectId(event.target.value)}
                disabled={readOnly}
                className={fieldClass}
              >
                <option value="" disabled>
                  Select a project
                </option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.project_number} · {project.title}
                  </option>
                ))}
              </select>
            )}
          </label>
          <div className="grid gap-2 text-sm">
            <span className="font-medium">Client</span>
            <div className="rounded-xl border border-card-border bg-background px-3 py-2 text-foreground">
              {clientDisplayName(selectedProject?.client ?? null)}
              {selectedProject?.client?.company_name
                ? ` · ${selectedProject.client.company_name}`
                : ""}
            </div>
          </div>
          <div className="grid gap-2 text-sm">
            <span className="font-medium">Currency</span>
            <div className="rounded-xl border border-card-border bg-background px-3 py-2 text-foreground">
              {currency}
            </div>
          </div>
          <label className="grid gap-2 text-sm">
            <span className="font-medium">Valid until</span>
            <input
              type="datetime-local"
              name="valid_until"
              value={validUntil}
              onChange={(event) => setValidUntil(event.target.value)}
              disabled={readOnly}
              className={fieldClass}
            />
          </label>
        </div>
      </AdminPanel>

      <AdminPanel title="Line items" description="Quantity × unit price is calculated per row.">
        <div className="space-y-3">
          {lines.map((line, index) => {
            const quantity = Number(line.quantity);
            const unitPrice = Number(line.unit_price);
            const amount =
              Number.isFinite(quantity) && Number.isFinite(unitPrice)
                ? lineAmount(quantity, unitPrice)
                : 0;

            return (
              <div
                key={line.key}
                className="grid gap-3 rounded-2xl border border-card-border bg-background p-3 lg:grid-cols-[minmax(0,2fr)_8rem_8rem_8rem_auto]"
              >
                <label className="grid gap-1 text-xs text-muted">
                  Description
                  <input
                    name="item_description"
                    required
                    value={line.description}
                    onChange={(event) => updateLine(line.key, { description: event.target.value })}
                    disabled={readOnly}
                    className={fieldClass}
                    placeholder={`Line ${index + 1}`}
                  />
                </label>
                <label className="grid gap-1 text-xs text-muted">
                  Quantity
                  <input
                    name="item_quantity"
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    value={line.quantity}
                    onChange={(event) => updateLine(line.key, { quantity: event.target.value })}
                    disabled={readOnly}
                    className={fieldClass}
                  />
                </label>
                <label className="grid gap-1 text-xs text-muted">
                  Unit price
                  <input
                    name="item_unit_price"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={line.unit_price}
                    onChange={(event) => updateLine(line.key, { unit_price: event.target.value })}
                    disabled={readOnly}
                    className={fieldClass}
                  />
                </label>
                <div className="grid gap-1 text-xs text-muted">
                  Amount
                  <div className="rounded-xl border border-card-border px-3 py-2 text-sm text-foreground">
                    {formatMoney(amount, currency)}
                  </div>
                </div>
                {readOnly ? null : (
                  <button
                    type="button"
                    onClick={() => removeLine(line.key)}
                    disabled={lines.length <= 1}
                    className="self-end rounded-xl border border-card-border px-3 py-2 text-sm text-muted disabled:opacity-40"
                  >
                    Remove
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {readOnly ? null : (
          <button
            type="button"
            onClick={addLine}
            className="mt-4 rounded-xl border border-card-border px-3 py-2 text-sm text-foreground"
          >
            Add line item
          </button>
        )}
      </AdminPanel>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <AdminPanel title="Notes and terms">
          <div className="grid gap-4">
            <label className="grid gap-2 text-sm">
              <span className="font-medium">Notes</span>
              <textarea
                name="notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                disabled={readOnly}
                className={`${fieldClass} min-h-28`}
              />
            </label>
            <label className="grid gap-2 text-sm">
              <span className="font-medium">Terms</span>
              <textarea
                name="terms"
                value={terms}
                onChange={(event) => setTerms(event.target.value)}
                disabled={readOnly}
                className={`${fieldClass} min-h-28`}
              />
            </label>
          </div>
        </AdminPanel>

        <AdminPanel title="Totals" description={`Currency stays ${currency} for this quote.`}>
          <dl className="grid gap-3 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-muted">Subtotal</dt>
              <dd className="font-medium text-foreground">{formatMoney(totals.subtotal, currency)}</dd>
            </div>
            <label className="flex items-center justify-between gap-3">
              <span className="text-muted">Discount</span>
              <input
                name="discount_total"
                type="number"
                min="0"
                step="0.01"
                value={discount}
                onChange={(event) => setDiscount(event.target.value)}
                disabled={readOnly}
                className={`${fieldClass} max-w-36 text-right`}
              />
            </label>
            <label className="flex items-center justify-between gap-3">
              <span className="text-muted">Tax</span>
              <input
                name="tax_total"
                type="number"
                min="0"
                step="0.01"
                value={tax}
                onChange={(event) => setTax(event.target.value)}
                disabled={readOnly}
                className={`${fieldClass} max-w-36 text-right`}
              />
            </label>
            <div className="flex items-center justify-between border-t border-card-border pt-3">
              <dt className="font-medium text-foreground">Total</dt>
              <dd className="font-display text-lg text-foreground">
                {formatMoney(totals.total, currency)}
              </dd>
            </div>
          </dl>
          {calculation.ok ? null : (
            <p className="mt-3 text-xs text-red-600" role="alert">
              {calculation.error}
            </p>
          )}
          {readOnly ? null : (
            <div className="mt-4">
              <SubmitButton pendingLabel="Saving draft…" className={!calculation.ok ? "pointer-events-none opacity-60" : undefined}>
                Save draft
              </SubmitButton>
            </div>
          )}
        </AdminPanel>
      </div>
      </fieldset>
    </ActionForm>
  );
}
