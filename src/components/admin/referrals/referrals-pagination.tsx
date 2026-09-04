import Link from "next/link";
import {
  buildReferralsHref,
  type ReferralListFilters,
} from "@/lib/admin-referral-constants";

export function ReferralsPagination({
  filters,
  total,
  page,
  totalPages,
}: {
  filters: ReferralListFilters;
  total: number;
  page: number;
  totalPages: number;
}) {
  if (totalPages <= 1) {
    return null;
  }

  const pageSize = 25;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <nav
      aria-label="Referral list pagination"
      className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted"
    >
      <p>
        Showing {start}–{end} of {total} referrals · Page {page} of {totalPages}
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link
            href={buildReferralsHref({ ...filters, page: String(page - 1) })}
            className="rounded-xl border border-card-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:border-foreground"
          >
            Previous
          </Link>
        ) : null}
        {page < totalPages ? (
          <Link
            href={buildReferralsHref({ ...filters, page: String(page + 1) })}
            className="rounded-xl border border-card-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:border-foreground"
          >
            Next
          </Link>
        ) : null}
      </div>
    </nav>
  );
}

export function ReferralsEmptyState({
  hasFilters,
  clearHref,
}: {
  hasFilters: boolean;
  clearHref: string;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-card-border bg-card p-8 text-center">
      <p className="text-sm text-muted">No referrals match the current filters.</p>
      {hasFilters ? (
        <Link
          href={clearHref}
          className="mt-3 inline-block rounded-xl border border-card-border px-3 py-2 text-sm font-medium text-foreground hover:border-foreground"
        >
          Clear filters
        </Link>
      ) : null}
    </div>
  );
}
