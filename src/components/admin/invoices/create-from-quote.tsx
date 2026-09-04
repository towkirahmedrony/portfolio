import { ActionForm, SubmitButton } from "@/components/admin/projects/action-form";
import { AdminPanel } from "@/components/admin/projects/query-state";
import { formatMoney } from "@/lib/admin-dashboard";
import { clientDisplayName } from "@/lib/admin-projects";
import { createInvoiceFromQuote } from "@/lib/admin-invoice-actions";
import type { AcceptedQuoteOption } from "@/lib/admin-invoice-constants";

const fieldClass =
  "w-full rounded-xl border border-card-border bg-background px-3 py-2 text-sm text-foreground";

export function CreateInvoiceFromQuote({ quotes }: { quotes: AcceptedQuoteOption[] }) {
  return (
    <AdminPanel
      title="Create invoice from accepted quote"
      description="Copies quote items and totals into a draft invoice. Existing quote-to-invoice links are not reused."
    >
      <ActionForm action={createInvoiceFromQuote} className="grid gap-4">
        <label className="grid gap-2 text-sm">
          <span className="font-medium">Accepted quote</span>
          <select name="quoteId" required defaultValue="" className={fieldClass}>
            <option value="" disabled>
              Select a quote
            </option>
            {quotes.map((quote) => (
              <option key={quote.id} value={quote.id}>
                {quote.project
                  ? `${quote.project.project_number} · ${quote.project.title}`
                  : "Unknown project"}
                {" · v"}
                {quote.version}
                {" · "}
                {formatMoney(Number(quote.total), quote.currency)}
                {" · "}
                {clientDisplayName(quote.client)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm">
          <span className="font-medium">Due date</span>
          <input type="date" name="due_date" className={fieldClass} />
        </label>
        <SubmitButton pendingLabel="Creating invoice…">Create draft invoice</SubmitButton>
      </ActionForm>
    </AdminPanel>
  );
}
