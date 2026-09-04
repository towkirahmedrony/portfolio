import Link from "next/link";
import {
  buildClientsHref,
  type ClientListFilters,
} from "@/lib/admin-client-constants";

export function ClientsPagination({
  filters,
  total,
  page,
  totalPages,
  pageSize,
}: {
  filters: ClientListFilters;
  total: number;
  page: number;
  totalPages: number;
  pageSize: number;
}) {
  if (totalPages <= 1 && total <= pageSize) {
    return null;
  }

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const prevHref = buildClientsHref({ ...filters, page: String(page - 1) });
  const nextHref = buildClientsHref({ ...filters, page: String(page + 1) });

  return (
    <nav
      aria-label="Client list pagination"
      className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted"
    >
      <p>
        Showing {total === 0 ? 0 : start}–{end} of {total} clients · Page {page} of{" "}
        {totalPages}
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link
            href={prevHref}
            className="rounded-xl border border-card-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:border-foreground"
          >
            Previous
          </Link>
        ) : null}
        {page < totalPages ? (
          <Link
            href={nextHref}
            className="rounded-xl border border-card-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:border-foreground"
          >
            Next
          </Link>
        ) : null}
      </div>
    </nav>
  );
}

export function ClientsEmptyState({
  hasFilters,
  clearHref,
}: {
  hasFilters: boolean;
  clearHref: string;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-card-border bg-card p-8 text-center">
      <p className="text-sm text-muted">No clients match the current filters.</p>
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
