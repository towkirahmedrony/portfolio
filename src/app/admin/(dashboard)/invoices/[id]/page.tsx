import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminPage } from "@/components/admin/admin-page";
import { QueryStateNotice, StatusPill } from "@/components/admin/projects/query-state";
import { InvoiceActions } from "@/components/admin/invoices/invoice-actions";
import { InvoiceEditor } from "@/components/admin/invoices/invoice-editor";
import { InvoicePaymentHistory } from "@/components/admin/invoices/invoice-payments";
import { InvoiceSummary } from "@/components/admin/invoices/invoice-summary";
import { clientDisplayName, formatDate } from "@/lib/admin-projects";
import {
  canEditInvoiceItems,
  formatInvoiceStatusLabel,
  getInvoiceStatusStyle,
  isInvoiceOverdue,
} from "@/lib/admin-invoice-constants";
import { getAdminInvoice } from "@/lib/admin-invoices";
import { requireAdmin } from "@/lib/require-admin";

export default async function AdminInvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const invoiceResult = await getAdminInvoice(id);

  if (invoiceResult.status === "empty") {
    notFound();
  }

  if (invoiceResult.status === "error" || invoiceResult.status === "unavailable") {
    return (
      <AdminPage
        title="Invoice"
        description="Could not load this invoice."
        className="mx-auto w-full max-w-6xl"
      >
        <QueryStateNotice result={invoiceResult} />
      </AdminPage>
    );
  }

  const { invoice, items, project, client, quote, payments } = invoiceResult.data;
  const editable = canEditInvoiceItems(invoice.status);
  const overdue = isInvoiceOverdue(invoice);

  return (
    <AdminPage
      title={invoice.invoice_number}
      description={
        project
          ? `${project.project_number} · ${project.title}`
          : "Invoice detail"
      }
      className="mx-auto w-full max-w-6xl"
    >
      <Link
        href="/admin/invoices"
        className="mb-6 inline-block text-sm text-muted hover:text-foreground"
      >
        Back to all invoices
      </Link>
      <div className="mb-6 flex flex-wrap items-center gap-2">
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
        <span className="text-sm text-muted">{clientDisplayName(client)}</span>
        <span className="text-sm text-muted">Issued {formatDate(invoice.issue_date)}</span>
        {invoice.due_date ? (
          <span className={`text-sm ${overdue ? "font-medium text-red-700 dark:text-red-400" : "text-muted"}`}>
            Due {formatDate(invoice.due_date)}
          </span>
        ) : null}
      </div>
      {editable ? null : (
        <p className="mb-6 text-sm text-muted">
          Line items are locked after issue. Status and payments can still be updated according to allowed transitions.
        </p>
      )}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid gap-6">
          <InvoiceEditor
            invoice={invoice}
            items={items}
            project={project}
            client={client}
            readOnly={!editable}
          />
          <InvoicePaymentHistory payments={payments} currency={invoice.currency || "BDT"} />
        </div>
        <div className="grid gap-6 self-start">
          <InvoiceSummary
            invoice={invoice}
            project={project}
            client={client}
            quote={quote}
          />
          <InvoiceActions invoice={invoice} />
        </div>
      </div>
    </AdminPage>
  );
}
