import Link from "next/link";
import {
  INVOICE_STATUSES,
  buildInvoicesHref,
  formatInvoiceStatusLabel,
  type InvoiceListFilters,
} from "@/lib/admin-invoice-constants";

const FILTERS: Array<{ label: string; value: string }> = [
  { label: "All", value: "all" },
  ...INVOICE_STATUSES.map((status) => ({
    label: formatInvoiceStatusLabel(status),
    value: status,
  })),
];

export function InvoicesToolbar({ filters }: { filters: InvoiceListFilters }) {
  const active = filters.status && filters.status !== "all" ? filters.status : "all";

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((filter) => (
          <Link
            key={filter.value}
            href={buildInvoicesHref({ status: filter.value })}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              active === filter.value
                ? "border-foreground bg-foreground text-background"
                : "border-card-border text-muted hover:text-foreground"
            }`}
          >
            {filter.label}
          </Link>
        ))}
      </div>
      <Link
        href="/admin/invoices/new"
        className="rounded-xl bg-foreground px-3 py-2 text-sm font-medium text-background"
      >
        Create from quote
      </Link>
    </div>
  );
}
