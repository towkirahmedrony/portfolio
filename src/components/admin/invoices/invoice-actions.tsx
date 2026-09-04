import { ActionForm, SubmitButton } from "@/components/admin/projects/action-form";
import { AdminPanel } from "@/components/admin/projects/query-state";
import {
  PAYMENT_TYPES,
  canIssueInvoice,
  canRecordManualPayment,
  formatInvoiceStatusLabel,
  formatPaymentTypeLabel,
  getAllowedInvoiceTransitions,
} from "@/lib/admin-invoice-constants";
import {
  issueInvoice,
  recordManualPayment,
  updateInvoiceStatus,
} from "@/lib/admin-invoice-actions";
import type { InvoiceRow } from "@/types/database";

const fieldClass =
  "w-full rounded-xl border border-card-border bg-background px-3 py-2 text-sm text-foreground";

export function InvoiceActions({ invoice }: { invoice: InvoiceRow }) {
  const transitions = getAllowedInvoiceTransitions(invoice.status);
  const allowPayment = canRecordManualPayment(invoice.status);

  return (
    <div className="grid gap-6">
      <AdminPanel title="Actions" description="Issue drafts and keep invoice status within allowed transitions.">
        <div className="flex flex-wrap gap-2">
          {canIssueInvoice(invoice.status) ? (
            <ActionForm action={issueInvoice}>
              <input type="hidden" name="invoiceId" value={invoice.id} />
              <SubmitButton pendingLabel="Issuing…">Issue invoice</SubmitButton>
            </ActionForm>
          ) : null}
        </div>
        {canIssueInvoice(invoice.status) ? null : (
          <p className="text-sm text-muted">
            {formatInvoiceStatusLabel(invoice.status)} invoices cannot be reissued.
          </p>
        )}
      </AdminPanel>

      <AdminPanel
        title="Status workflow"
        description="Only allowed invoice_status transitions can be applied. Paid and partially paid are derived from payments."
      >
        {transitions.length === 0 ? (
          <p className="text-sm text-muted">
            {formatInvoiceStatusLabel(invoice.status)} is a terminal status.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {transitions.map((status) => (
              <ActionForm key={status} action={updateInvoiceStatus}>
                <input type="hidden" name="invoiceId" value={invoice.id} />
                <input type="hidden" name="status" value={status} />
                <SubmitButton variant="secondary" pendingLabel="Updating…">
                  {`Mark ${formatInvoiceStatusLabel(status).toLowerCase()}`}
                </SubmitButton>
              </ActionForm>
            ))}
          </div>
        )}
      </AdminPanel>

      <AdminPanel
        title="Record manual payment"
        description="No payment gateway is connected. Manual succeeded payments update amount_paid and amount_due in one transaction."
      >
        {allowPayment ? (
          <ActionForm action={recordManualPayment} className="grid gap-3" successMessage="Payment recorded.">
            <input type="hidden" name="invoiceId" value={invoice.id} />
            <label className="grid gap-1 text-xs text-muted">
              Amount
              <input
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                required
                className={fieldClass}
              />
            </label>
            <label className="grid gap-1 text-xs text-muted">
              Payment type
              <select name="payment_type" defaultValue="full" className={fieldClass}>
                {PAYMENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {formatPaymentTypeLabel(type)}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs text-muted">
              Payment method
              <input name="payment_method" placeholder="Bank transfer, cash…" className={fieldClass} />
            </label>
            <label className="grid gap-1 text-xs text-muted">
              Provider
              <input name="provider" defaultValue="manual" className={fieldClass} />
            </label>
            <label className="grid gap-1 text-xs text-muted">
              Transaction reference
              <input name="transaction_reference" className={fieldClass} />
            </label>
            <label className="grid gap-1 text-xs text-muted">
              Paid date
              <input name="paid_at" type="datetime-local" className={fieldClass} />
            </label>
            <SubmitButton pendingLabel="Recording…">Record payment</SubmitButton>
          </ActionForm>
        ) : (
          <p className="text-sm text-muted">
            Issue the invoice before recording a payment.
          </p>
        )}
      </AdminPanel>
    </div>
  );
}
