import Link from "next/link";
import { AdminPanel, StatusPill } from "@/components/admin/projects/query-state";
import { formatMoney } from "@/lib/admin-dashboard";
import { formatDateTime } from "@/lib/admin-projects";
import {
  formatPaymentStatusLabel,
  formatPaymentTypeLabel,
  getPaymentStatusStyle,
} from "@/lib/admin-invoice-constants";
import type { PaymentRow } from "@/types/database";

export function InvoicePaymentHistory({
  payments,
  currency,
}: {
  payments: PaymentRow[];
  currency: string;
}) {
  return (
    <AdminPanel
      title="Payment history"
      description="Succeeded payments from the payments table. Gateway webhooks are not generated here."
    >
      {payments.length === 0 ? (
        <p className="text-sm text-muted">No payments recorded yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr>
                {["Amount", "Type", "Status", "Method", "Reference", "Paid"].map((header) => (
                  <th key={header} className="px-2 py-2">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id} className="border-t border-card-border/70">
                  <td className="px-2 py-2 font-medium text-foreground">
                    {formatMoney(Number(payment.amount), payment.currency || currency)}
                  </td>
                  <td className="px-2 py-2 text-foreground">
                    {formatPaymentTypeLabel(payment.payment_type)}
                  </td>
                  <td className="px-2 py-2">
                    <StatusPill
                      label={formatPaymentStatusLabel(payment.status)}
                      className={getPaymentStatusStyle(payment.status)}
                    />
                  </td>
                  <td className="px-2 py-2 text-muted">
                    {payment.payment_method || payment.provider || "—"}
                  </td>
                  <td className="px-2 py-2 text-muted">{payment.transaction_reference || "—"}</td>
                  <td className="px-2 py-2 text-muted">{formatDateTime(payment.paid_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-4 text-xs text-muted">
        Open the full <Link href="/admin/payments" className="underline hover:text-foreground">payments</Link> ledger.
      </p>
    </AdminPanel>
  );
}
