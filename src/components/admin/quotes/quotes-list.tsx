import Link from "next/link";
import { formatMoney } from "@/lib/admin-dashboard";
import { clientDisplayName, formatDateTime } from "@/lib/admin-projects";
import {
  formatQuoteStatusLabel,
  getQuoteStatusStyle,
  quoteDisplayId,
  type AdminQuoteListItem,
} from "@/lib/admin-quote-constants";
import { StatusPill } from "@/components/admin/projects/query-state";

export function QuotesListTable({ quotes }: { quotes: AdminQuoteListItem[] }) {
  return (
    <div className="overflow-x-auto rounded-3xl border border-card-border bg-card">
      <table className="w-full min-w-[72rem] text-left text-sm">
        <thead className="border-b border-card-border text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-4 py-3">Quote / version</th>
            <th className="px-4 py-3">Project</th>
            <th className="px-4 py-3">Client</th>
            <th className="px-4 py-3">Version</th>
            <th className="px-4 py-3">Subtotal</th>
            <th className="px-4 py-3">Discount</th>
            <th className="px-4 py-3">Tax</th>
            <th className="px-4 py-3">Total</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Valid until</th>
            <th className="px-4 py-3">Created / sent</th>
          </tr>
        </thead>
        <tbody>
          {quotes.map((quote) => (
            <tr
              key={quote.id}
              className="border-b border-card-border/60 last:border-0 hover:bg-foreground/[0.02]"
            >
              <td className="px-4 py-3">
                <Link
                  href={`/admin/quotes/${quote.id}`}
                  className="font-medium text-foreground hover:underline"
                >
                  {quoteDisplayId(quote)}
                </Link>
              </td>
              <td className="px-4 py-3">
                {quote.project ? (
                  <Link
                    href={`/admin/projects/${quote.project.id}`}
                    className="text-foreground hover:underline"
                  >
                    <div>{quote.project.project_number}</div>
                    <div className="text-xs text-muted">{quote.project.title}</div>
                  </Link>
                ) : (
                  <span className="text-muted">Unknown project</span>
                )}
              </td>
              <td className="px-4 py-3">
                <div className="text-foreground">{clientDisplayName(quote.client)}</div>
                {quote.client?.company_name ? (
                  <div className="text-xs text-muted">{quote.client.company_name}</div>
                ) : null}
              </td>
              <td className="px-4 py-3 text-foreground">v{quote.version}</td>
              <td className="px-4 py-3 text-muted">
                {formatMoney(Number(quote.subtotal), quote.currency || "BDT")}
              </td>
              <td className="px-4 py-3 text-muted">
                {formatMoney(Number(quote.discount_total), quote.currency || "BDT")}
              </td>
              <td className="px-4 py-3 text-muted">
                {formatMoney(Number(quote.tax_total), quote.currency || "BDT")}
              </td>
              <td className="px-4 py-3 font-medium text-foreground">
                {formatMoney(Number(quote.total), quote.currency || "BDT")}
              </td>
              <td className="px-4 py-3">
                <StatusPill
                  label={formatQuoteStatusLabel(quote.status)}
                  className={getQuoteStatusStyle(quote.status)}
                />
              </td>
              <td className="px-4 py-3 text-muted">{formatDateTime(quote.valid_until)}</td>
              <td className="px-4 py-3 text-muted">
                <div>{formatDateTime(quote.created_at)}</div>
                {quote.sent_at ? (
                  <div className="text-xs">Sent {formatDateTime(quote.sent_at)}</div>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
