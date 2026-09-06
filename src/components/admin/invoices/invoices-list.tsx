import Link from "next/link";
import { formatMoney } from "@/lib/admin-dashboard";
import { clientDisplayName, formatDate } from "@/lib/admin-projects";
import {
  formatInvoiceStatusLabel,
  getInvoiceStatusStyle,
  type AdminInvoiceListItem,
} from "@/lib/admin-invoice-constants";
import { StatusPill } from "@/components/admin/projects/query-state";

export function InvoicesListTable({ invoices }: { invoices: AdminInvoiceListItem[] }) {
  return (
    <div className="overflow-x-auto rounded-3xl border border-card-border bg-card">
      <table className="w-full min-w-[72rem] text-left text-sm">
        <thead className="border-b border-card-border text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-4 py-3">Invoice number</th>
            <th className="px-4 py-3">Project</th>
            <th className="px-4 py-3">Client</th>
            <th className="px-4 py-3">Total</th>
            <th className="px-4 py-3">Amount paid</th>
            <th className="px-4 py-3">Amount due</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Issue date</th>
            <th className="px-4 py-3">Due date</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((invoice) => (
            <tr
              key={invoice.id}
              className={`border-b border-card-border/60 last:border-0 hover:bg-foreground/[0.02] ${
                invoice.isOverdue ? "bg-red-500/5" : ""
              }`}
            >
              <td className="px-4 py-3">
                <Link
                  href={`/admin/invoices/${invoice.id}`}
                  className="font-medium text-foreground hover:underline"
                >
                  {invoice.invoice_number}
                </Link>
              </td>
              <td className="px-4 py-3">
                {invoice.project ? (
                  <Link
                    href={`/admin/projects/${invoice.project.id}`}
                    className="text-foreground hover:underline"
                  >
                    <div>{invoice.project.project_number}</div>
                    <div className="text-xs text-muted">{invoice.project.title}</div>
                  </Link>
                ) : (
                  <span className="text-muted">Unknown project</span>
                )}
              </td>
              <td className="px-4 py-3">
                <div className="text-foreground">{clientDisplayName(invoice.client)}</div>
                {invoice.client?.company_name ? (
                  <div className="text-xs text-muted">{invoice.client.company_name}</div>
                ) : null}
              </td>
              <td className="px-4 py-3 font-medium text-foreground">
                {formatMoney(Number(invoice.total), invoice.currency || "BDT")}
              </td>
              <td className="px-4 py-3 text-muted">
                {formatMoney(Number(invoice.amount_paid), invoice.currency || "BDT")}
              </td>
              <td className="px-4 py-3 text-muted">
                {formatMoney(Number(invoice.amount_due), invoice.currency || "BDT")}
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill
                    label={formatInvoiceStatusLabel(invoice.status)}
                    className={getInvoiceStatusStyle(invoice.status)}
                  />
                  {invoice.isOverdue && invoice.status !== "overdue" ? (
                    <StatusPill
                      label="Overdue"
                      className="border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400"
                    />
                  ) : null}
                </div>
              </td>
              <td className="px-4 py-3 text-muted">{formatDate(invoice.issue_date)}</td>
              <td className={`px-4 py-3 ${invoice.isOverdue ? "font-medium text-red-700 dark:text-red-400" : "text-muted"}`}>
                {formatDate(invoice.due_date)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
