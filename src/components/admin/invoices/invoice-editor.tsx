"use client";

import { useMemo, useState } from "react";
import { ActionForm, SubmitButton } from "@/components/admin/projects/action-form";
import { AdminPanel } from "@/components/admin/projects/query-state";
import { clientDisplayName } from "@/lib/admin-project-constants";
import { saveInvoiceDraft } from "@/lib/admin-invoice-actions";
import type { InvoiceClient, InvoiceProjectSummary } from "@/lib/admin-invoice-constants";
import {
  calculateQuoteFinancials,
  formatMoney,
  lineAmount,
  roundMoney,
} from "@/lib/quote-money";
import type { InvoiceItemRow, InvoiceRow } from "@/types/database";

type EditorLine = {
  key: string;
  description: string;
  quantity: string;
  unit_price: string;
};

const fieldClass =
  "w-full rounded-xl border border-card-border bg-background px-3 py-2 text-sm text-foreground";

function emptyLine(): EditorLine {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    description: "",
    quantity: "1",
    unit_price: "0",
  };
}

function fromInvoiceItems(items: InvoiceItemRow[]): EditorLine[] {
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

export function InvoiceEditor({
  invoice,
  items,
  project,
  client,
  readOnly = false,
}: {
  invoice: InvoiceRow;
  items: InvoiceItemRow[];
  project: InvoiceProjectSummary | null;
  client: InvoiceClient | null;
  readOnly?: boolean;
}) {
  const [lines, setLines] = useState<EditorLine[]>(() => fromInvoiceItems(items));
  const [discount, setDiscount] = useState(String(invoice.discount_total ?? 0));
  const [tax, setTax] = useState(String(invoice.tax_total ?? 0));
  const [dueDate, setDueDate] = useState(invoice.due_date ?? "");
  const currency = invoice.currency || project?.currency || "BDT";

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

  const amountPaid = roundMoney(Number(invoice.amount_paid ?? 0));
  const amountDue = roundMoney(Math.max(0, totals.total - amountPaid));

  return (
    <ActionForm action={saveInvoiceDraft} className="grid gap-6" successMessage="Invoice totals recalculated.">
      <fieldset disabled={readOnly} className="grid gap-6">
        <input type="hidden" name="invoiceId" value={invoice.id} />
        <input type="hidden" name="subtotal" value={totals.subtotal} />
        <input type="hidden" name="total" value={totals.total} />

        <AdminPanel
          title={invoice.invoice_number}
          description="Line amounts, subtotal, discount, tax, and total are calculated before save."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2 text-sm">
              <span className="font-medium">Project</span>
              <div className="rounded-xl border border-card-border bg-background px-3 py-2 text-foreground">
                {project ? `${project.project_number} · ${project.title}` : invoice.project_id}
              </div>
            </div>
            <div className="grid gap-2 text-sm">
              <span className="font-medium">Client</span>
              <div className="rounded-xl border border-card-border bg-background px-3 py-2 text-foreground">
                {clientDisplayName(client)}
                {client?.company_name ? ` · ${client.company_name}` : ""}
              </div>
            </div>
            <div className="grid gap-2 text-sm">
              <span className="font-medium">Currency</span>
              <div className="rounded-xl border border-card-border bg-background px-3 py-2 text-foreground">
                {currency}
              </div>
            </div>
            <label className="grid gap-2 text-sm">
              <span className="font-medium">Due date</span>
              <input
                type="date"
                name="due_date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
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

        <AdminPanel title="Totals" description={`Currency stays ${currency} for this invoice.`}>
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
            <div className="flex items-center justify-between">
              <dt className="text-muted">Amount paid</dt>
              <dd className="text-foreground">{formatMoney(amountPaid, currency)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted">Amount due</dt>
              <dd className="font-medium text-foreground">{formatMoney(amountDue, currency)}</dd>
            </div>
          </dl>
          {calculation.ok ? null : (
            <p className="mt-3 text-xs text-red-600" role="alert">
              {calculation.error}
            </p>
          )}
          {readOnly ? null : (
            <div className="mt-4">
              <SubmitButton
                pendingLabel="Recalculating…"
                className={!calculation.ok ? "pointer-events-none opacity-60" : undefined}
              >
                Save and recalculate
              </SubmitButton>
            </div>
          )}
        </AdminPanel>
      </fieldset>
    </ActionForm>
  );
}
