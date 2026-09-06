import Link from "next/link";
import { AdminPanel, StatusPill } from "@/components/admin/projects/query-state";
import { formatMoney } from "@/lib/admin-dashboard";
import { clientDisplayName, formatDate } from "@/lib/admin-projects";
import {
  formatInvoiceStatusLabel,
  getInvoiceStatusStyle,
  isInvoiceOverdue,
  type InvoiceClient,
  type InvoiceProjectSummary,
} from "@/lib/admin-invoice-constants";
import type { InvoiceRow, QuoteRow } from "@/types/database";

export function InvoiceSummary({
  invoice,
  project,
  client,
  quote,
}: {
  invoice: InvoiceRow;
  project: InvoiceProjectSummary | null;
  client: InvoiceClient | null;
  quote: Pick<QuoteRow, "id" | "version" | "status" | "total" | "currency"> | null;
}) {
  const overdue = isInvoiceOverdue(invoice);

  return (
    <AdminPanel title="Client and project" description="Invoice ownership comes from invoices.client_id and invoices.project_id.">
      <dl className="grid gap-3 text-sm">
        <div className="flex items-start justify-between gap-4">
          <dt className="text-muted">Client</dt>
          <dd className="text-right text-foreground">
            <div>{clientDisplayName(client)}</div>
            {client?.company_name ? <div className="text-xs text-muted">{client.company_name}</div> : null}
            {client?.job_title ? <div className="text-xs text-muted">{client.job_title}</div> : null}
            {client?.phone ? <div className="text-xs text-muted">{client.phone}</div> : null}
          </dd>
        </div>
        <div className="flex items-start justify-between gap-4">
          <dt className="text-muted">Project</dt>
          <dd className="text-right text-foreground">
            {project ? (
              <Link href={`/admin/projects/${project.id}`} className="hover:underline">
                {project.project_number} · {project.title}
              </Link>
            ) : (
              "Unknown project"
            )}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-muted">Status</dt>
          <dd className="flex flex-wrap justify-end gap-2">
            <StatusPill
              label={formatInvoiceStatusLabel(invoice.status)}
              className={getInvoiceStatusStyle(invoice.status)}
            />
            {overdue && invoice.status !== "overdue" ? (
              <StatusPill
                label="Overdue"
                className="border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400"
              />
            ) : null}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-muted">Issue date</dt>
          <dd className="text-foreground">{formatDate(invoice.issue_date)}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-muted">Due date</dt>
          <dd className={overdue ? "font-medium text-red-700 dark:text-red-400" : "text-foreground"}>
            {formatDate(invoice.due_date)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-muted">Total</dt>
          <dd className="font-medium text-foreground">{formatMoney(Number(invoice.total), invoice.currency || "BDT")}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-muted">Amount paid</dt>
          <dd className="text-foreground">{formatMoney(Number(invoice.amount_paid), invoice.currency || "BDT")}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-muted">Amount due</dt>
          <dd className="font-medium text-foreground">{formatMoney(Number(invoice.amount_due), invoice.currency || "BDT")}</dd>
        </div>
        {quote ? (
          <div className="flex items-center justify-between gap-4">
            <dt className="text-muted">Source quote</dt>
            <dd>
              <Link href={`/admin/quotes/${quote.id}`} className="text-foreground hover:underline">
                v{quote.version}
              </Link>
            </dd>
          </div>
        ) : null}
      </dl>
    </AdminPanel>
  );
}
