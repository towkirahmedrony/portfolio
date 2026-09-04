import Link from "next/link";
import {
  PAYMENT_STATUSES,
  PAYMENT_TYPES,
  buildPaymentsHref,
  formatPaymentStatusLabel,
  formatPaymentTypeLabel,
  type PaymentListFilters,
} from "@/lib/admin-invoice-constants";

export function PaymentsToolbar({ filters }: { filters: PaymentListFilters }) {
  const activeStatus = filters.status && filters.status !== "all" ? filters.status : "all";
  const activeType = filters.type && filters.type !== "all" ? filters.type : "all";

  return (
    <div className="mb-6 grid gap-4">
      <div className="flex flex-wrap gap-2">
        <Link
          href={buildPaymentsHref({ status: "all", type: activeType })}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            activeStatus === "all"
              ? "border-foreground bg-foreground text-background"
              : "border-card-border text-muted hover:text-foreground"
          }`}
        >
          All statuses
        </Link>
        {PAYMENT_STATUSES.map((status) => (
          <Link
            key={status}
            href={buildPaymentsHref({ status, type: activeType })}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              activeStatus === status
                ? "border-foreground bg-foreground text-background"
                : "border-card-border text-muted hover:text-foreground"
            }`}
          >
            {formatPaymentStatusLabel(status)}
          </Link>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Link
          href={buildPaymentsHref({ status: activeStatus, type: "all" })}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            activeType === "all"
              ? "border-foreground bg-foreground text-background"
              : "border-card-border text-muted hover:text-foreground"
          }`}
        >
          All types
        </Link>
        {PAYMENT_TYPES.map((type) => (
          <Link
            key={type}
            href={buildPaymentsHref({ status: activeStatus, type })}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              activeType === type
                ? "border-foreground bg-foreground text-background"
                : "border-card-border text-muted hover:text-foreground"
            }`}
          >
            {formatPaymentTypeLabel(type)}
          </Link>
        ))}
      </div>
    </div>
  );
}
