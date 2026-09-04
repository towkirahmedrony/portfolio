import Link from "next/link";
import {
  buildPaymentEventsHref,
  type PaymentEventListFilters,
} from "@/lib/admin-invoice-constants";

const fieldClass =
  "rounded-xl border border-card-border bg-background px-3 py-2 text-sm text-foreground";

export function PaymentEventsToolbar({ filters }: { filters: PaymentEventListFilters }) {
  return (
    <form action="/admin/payment-events" className="mb-6 flex flex-wrap items-end gap-3">
      <label className="grid gap-1 text-xs text-muted">
        Search
        <input
          name="q"
          defaultValue={filters.q ?? ""}
          placeholder="Event ID, type, provider, error"
          className={`${fieldClass} min-w-64`}
        />
      </label>
      <label className="grid gap-1 text-xs text-muted">
        Provider
        <input
          name="provider"
          defaultValue={filters.provider ?? ""}
          placeholder="stripe, bkash…"
          className={fieldClass}
        />
      </label>
      <label className="grid gap-1 text-xs text-muted">
        Processed
        <select name="processed" defaultValue={filters.processed ?? "all"} className={fieldClass}>
          <option value="all">All</option>
          <option value="true">Processed</option>
          <option value="false">Unprocessed</option>
        </select>
      </label>
      <button type="submit" className="rounded-xl bg-foreground px-3 py-2 text-sm font-medium text-background">
        Filter events
      </button>
      <Link href={buildPaymentEventsHref({})} className="rounded-xl border border-card-border px-3 py-2 text-sm text-muted">
        Reset
      </Link>
    </form>
  );
}
