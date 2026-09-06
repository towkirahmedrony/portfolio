import Link from "next/link";
import { formatMoney } from "@/lib/admin-dashboard";
import { clientDisplayName, formatDateTime } from "@/lib/admin-projects";
import {
  formatPaymentStatusLabel,
  formatPaymentTypeLabel,
  getPaymentStatusStyle,
  type AdminPaymentListItem,
} from "@/lib/admin-invoice-constants";
import { StatusPill } from "@/components/admin/projects/query-state";

export function PaymentsListTable({ payments }: { payments: AdminPaymentListItem[] }) {
  return (
    <div className="overflow-x-auto rounded-3xl border border-card-border bg-card">
      <table className="w-full min-w-[80rem] text-left text-sm">
        <thead className="border-b border-card-border text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-4 py-3">Client</th>
            <th className="px-4 py-3">Project</th>
            <th className="px-4 py-3">Invoice</th>
            <th className="px-4 py-3">Amount</th>
            <th className="px-4 py-3">Currency</th>
            <th className="px-4 py-3">Payment type</th>
            <th className="px-4 py-3">Payment method</th>
            <th className="px-4 py-3">Provider</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Transaction reference</th>
            <th className="px-4 py-3">Paid date</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((payment) => (
            <tr key={payment.id} className="border-b border-card-border/60 last:border-0 hover:bg-foreground/[0.02]">
              <td className="px-4 py-3">
                <div className="text-foreground">{clientDisplayName(payment.client)}</div>
                {payment.client?.company_name ? (
                  <div className="text-xs text-muted">{payment.client.company_name}</div>
                ) : null}
              </td>
              <td className="px-4 py-3">
                {payment.project ? (
                  <Link
                    href={`/admin/projects/${payment.project.id}`}
                    className="text-foreground hover:underline"
                  >
                    <div>{payment.project.project_number}</div>
                    <div className="text-xs text-muted">{payment.project.title}</div>
                  </Link>
                ) : (
                  <span className="text-muted">Unknown project</span>
                )}
              </td>
              <td className="px-4 py-3">
                {payment.invoice ? (
                  <Link
                    href={`/admin/invoices/${payment.invoice.id}`}
                    className="text-foreground hover:underline"
                  >
                    {payment.invoice.invoice_number}
                  </Link>
                ) : (
                  <span className="text-muted">Unknown invoice</span>
                )}
              </td>
              <td className="px-4 py-3 font-medium text-foreground">
                {formatMoney(Number(payment.amount), payment.currency || "BDT")}
              </td>
              <td className="px-4 py-3 text-muted">{payment.currency}</td>
              <td className="px-4 py-3 text-foreground">
                {formatPaymentTypeLabel(payment.payment_type)}
              </td>
              <td className="px-4 py-3 text-muted">{payment.payment_method || "—"}</td>
              <td className="px-4 py-3 text-muted">{payment.provider || "—"}</td>
              <td className="px-4 py-3">
                <StatusPill
                  label={formatPaymentStatusLabel(payment.status)}
                  className={getPaymentStatusStyle(payment.status)}
                />
              </td>
              <td className="px-4 py-3 text-muted">{payment.transaction_reference || "—"}</td>
              <td className="px-4 py-3 text-muted">{formatDateTime(payment.paid_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
