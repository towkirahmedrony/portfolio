import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ClientQuoteActions } from "@/components/profile/client-quote-actions";
import { formatDateTime } from "@/lib/admin-project-constants";
import {
  formatQuoteStatusLabel,
  getQuoteStatusStyle,
} from "@/lib/admin-quote-constants";
import type {
  CustomerInvoiceSummary,
  CustomerRequestQuote,
} from "@/lib/customer-project-requests";
import { formatMoney } from "@/lib/quote-money";
import type { QuoteItemRow } from "@/types/database";

function MoneyRow({
  label,
  value,
  currency,
  emphasize,
}: {
  label: string;
  value: number;
  currency: string;
  emphasize?: boolean;
}) {
  return (
    <div className={`flex justify-between gap-4 text-sm ${emphasize ? "font-medium" : ""}`}>
      <span className="text-muted">{label}</span>
      <span>{formatMoney(Number(value), currency)}</span>
    </div>
  );
}

export function ClientQuoteSection({
  quote,
  items,
  invoices,
  submittedBudget,
}: {
  quote: CustomerRequestQuote | null;
  items: QuoteItemRow[];
  invoices?: CustomerInvoiceSummary[];
  submittedBudget?: string | null;
}) {
  if (!quote) {
    return (
      <Card className="hover:translate-y-0">
        <h2 className="font-display text-xl tracking-tight">Quote</h2>
        <p className="mt-4 text-sm text-muted">
          No admin quote has been sent yet. Your submitted budget is not a quote.
        </p>
        {submittedBudget ? (
          <p className="mt-2 text-sm">
            <span className="text-muted">Your submitted budget: </span>
            {submittedBudget}
          </p>
        ) : null}
      </Card>
    );
  }

  const currency = quote.currency || "BDT";
  const relatedInvoice = invoices?.find((invoice) => invoice.quote_id === quote.id) ?? null;

  return (
    <Card className="hover:translate-y-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl tracking-tight">Quote</h2>
          <p className="mt-1 text-sm text-muted">{`Quote v${quote.version}`}</p>
        </div>
        <Badge className={getQuoteStatusStyle(quote.status)}>
          {formatQuoteStatusLabel(quote.status)}
        </Badge>
      </div>

      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-[10px] font-medium uppercase tracking-wider text-muted">Quoted amount</dt>
          <dd className="mt-1 text-lg font-medium">{formatMoney(quote.total, currency)}</dd>
        </div>
        {submittedBudget ? (
          <div>
            <dt className="text-[10px] font-medium uppercase tracking-wider text-muted">Your submitted budget</dt>
            <dd className="mt-1 text-sm text-foreground">{submittedBudget}</dd>
          </div>
        ) : null}
      </dl>

      {items.length > 0 ? (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="pb-2 pr-3">Item</th>
                <th className="pb-2 pr-3">Qty</th>
                <th className="pb-2 pr-3">Unit</th>
                <th className="pb-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-card-border">
                  <td className="py-2 pr-3">{item.description}</td>
                  <td className="py-2 pr-3">{item.quantity}</td>
                  <td className="py-2 pr-3">{formatMoney(Number(item.unit_price), currency)}</td>
                  <td className="py-2 text-right">{formatMoney(Number(item.amount), currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted">Line items are not available for this quote.</p>
      )}

      <div className="mt-6 space-y-2 border-t border-card-border pt-4">
        <MoneyRow label="Subtotal" value={quote.subtotal} currency={currency} />
        <MoneyRow label="Discount" value={quote.discount_total} currency={currency} />
        <MoneyRow label="Tax" value={quote.tax_total} currency={currency} />
        <MoneyRow label="Final total" value={quote.total} currency={currency} emphasize />
        <div className="flex justify-between gap-4 text-sm">
          <span className="text-muted">Currency</span>
          <span>{currency}</span>
        </div>
      </div>

      <dl className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-[10px] font-medium uppercase tracking-wider text-muted">Valid until</dt>
          <dd className="mt-1 text-sm">{formatDateTime(quote.valid_until)}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-medium uppercase tracking-wider text-muted">Sent</dt>
          <dd className="mt-1 text-sm">{formatDateTime(quote.sent_at)}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-medium uppercase tracking-wider text-muted">Accepted</dt>
          <dd className="mt-1 text-sm">{formatDateTime(quote.accepted_at)}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-medium uppercase tracking-wider text-muted">Rejected</dt>
          <dd className="mt-1 text-sm">{formatDateTime(quote.rejected_at)}</dd>
        </div>
      </dl>

      {quote.notes ? (
        <div className="mt-6">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted">Notes</p>
          <p className="mt-2 whitespace-pre-line text-sm leading-6">{quote.notes}</p>
        </div>
      ) : null}

      {quote.terms ? (
        <div className="mt-6">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted">Terms</p>
          <p className="mt-2 whitespace-pre-line text-sm leading-6">{quote.terms}</p>
        </div>
      ) : null}

      {relatedInvoice ? (
        <div className="mt-6 rounded-xl border border-card-border p-4">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted">Invoice amount</p>
          <p className="mt-1 text-sm font-medium">
            {relatedInvoice.invoice_number} · {formatMoney(Number(relatedInvoice.total), relatedInvoice.currency || currency)}
          </p>
          <p className="mt-1 text-xs text-muted">
            This is the invoice amount, not your submitted budget or the quote itself.
          </p>
        </div>
      ) : null}

      {quote.status === "rejected" ? (
        <p className="mt-6 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          This quote was rejected. Request changes if you still want a revised quote. The current quote is kept for history.
        </p>
      ) : null}

      <ClientQuoteActions quote={quote} />
    </Card>
  );
}
