import type { ReactNode } from "react";
import { AdminPanel, QueryStateNotice, StatusPill } from "@/components/admin/projects/query-state";
import { formatMoney } from "@/lib/admin-dashboard";
import { formatDate, formatDateTime, formatStatusLabel, type QueryResult } from "@/lib/admin-projects";
import type {
  InvoiceRow,
  PaymentRow,
  ProjectDiscountRow,
  QuoteRow,
} from "@/types/database";

export function ProjectFinancialTab({
  quotes,
  discounts,
  invoices,
  payments,
}: {
  quotes: QueryResult<QuoteRow[]>;
  discounts: QueryResult<ProjectDiscountRow[]>;
  invoices: QueryResult<InvoiceRow[]>;
  payments: QueryResult<PaymentRow[]>;
}) {
  return (
    <div className="grid gap-6">
      <FinancialSection
        title="Quotes"
        description="Related quote versions for this project."
        result={quotes}
        emptyMessage="No quotes for this project."
        render={(rows) => (
          <Table
            headers={["Version", "Status", "Subtotal", "Discount", "Tax", "Total", "Valid until"]}
            rows={rows.map((row) => [
              `v${row.version}`,
              formatStatusLabel(row.status),
              formatMoney(Number(row.subtotal), row.currency),
              formatMoney(Number(row.discount_total), row.currency),
              formatMoney(Number(row.tax_total), row.currency),
              formatMoney(Number(row.total), row.currency),
              formatDateTime(row.valid_until),
            ])}
          />
        )}
      />
      <FinancialSection
        title="Discounts"
        description="Referral, coupon, and manual discounts from project_discounts."
        result={discounts}
        emptyMessage="No discounts applied."
        render={(rows) => (
          <Table
            headers={["Label", "Source", "Amount", "Created"]}
            rows={rows.map((row) => [
              row.label || row.code || "Discount",
              formatStatusLabel(row.source_type),
              formatMoney(Number(row.discount_amount), row.currency),
              formatDateTime(row.created_at),
            ])}
          />
        )}
      />
      <FinancialSection
        title="Invoices"
        description="Issued invoices linked to this project."
        result={invoices}
        emptyMessage="No invoices yet."
        render={(rows) => (
          <Table
            headers={["Number", "Status", "Total", "Paid", "Due", "Issue date"]}
            rows={rows.map((row) => [
              row.invoice_number,
              formatStatusLabel(row.status),
              formatMoney(Number(row.total), row.currency),
              formatMoney(Number(row.amount_paid), row.currency),
              formatMoney(Number(row.amount_due), row.currency),
              formatDate(row.issue_date),
            ])}
          />
        )}
      />
      <FinancialSection
        title="Payments"
        description="Payment records from the payments table."
        result={payments}
        emptyMessage="No payments recorded."
        render={(rows) => (
          <Table
            headers={["Amount", "Type", "Status", "Method", "Paid at"]}
            rows={rows.map((row) => [
              formatMoney(Number(row.amount), row.currency),
              formatStatusLabel(row.payment_type),
              formatStatusLabel(row.status),
              row.payment_method || row.provider || "—",
              formatDateTime(row.paid_at),
            ])}
          />
        )}
      />
    </div>
  );
}

function FinancialSection<T>({
  title,
  description,
  result,
  emptyMessage,
  render,
}: {
  title: string;
  description: string;
  result: QueryResult<T[]>;
  emptyMessage: string;
  render: (rows: T[]) => ReactNode;
}) {
  return (
    <AdminPanel title={title} description={description}>
      {result.status === "error" || result.status === "unavailable" ? (
        <QueryStateNotice result={result} />
      ) : result.status === "empty" ? (
        <QueryStateNotice result={result} emptyMessage={emptyMessage} />
      ) : (
        render(result.data)
      )}
    </AdminPanel>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-muted">
          <tr>
            {headers.map((header) => (
              <th key={header} className="px-2 py-2">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-t border-card-border/70">
              {row.map((cell, cellIndex) => (
                <td key={`${index}-${cellIndex}`} className="px-2 py-2 text-foreground">
                  {cellIndex === 1 ? (
                    <StatusPill label={cell} className="border-card-border bg-background text-muted" />
                  ) : (
                    cell
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
