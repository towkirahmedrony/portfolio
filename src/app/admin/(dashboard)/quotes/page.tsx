import { Suspense } from "react";
import { AdminPage } from "@/components/admin/admin-page";
import { QueryStateNotice } from "@/components/admin/projects/query-state";
import { QuoteFromRequestPanel } from "@/components/admin/quotes/quote-from-request-panel";
import { QuotesListTable } from "@/components/admin/quotes/quotes-list";
import { QuotesListSkeleton } from "@/components/admin/quotes/quotes-skeleton";
import { QuotesToolbar } from "@/components/admin/quotes/quotes-toolbar";
import {
  getAdminQuotes,
  getQuoteEligibleProjectRequests,
  type QuoteListFilters,
} from "@/lib/admin-quotes";
import { requireAdmin } from "@/lib/require-admin";

async function QuotesContent({ filters }: { filters: QuoteListFilters }) {
  const [quotesResult, eligibleResult] = await Promise.all([
    getAdminQuotes(filters),
    getQuoteEligibleProjectRequests(),
  ]);

  const showEligible =
    eligibleResult.status === "ok" || eligibleResult.status === "empty";

  return (
    <div className="grid gap-8">
      {showEligible ? (
        <QuoteFromRequestPanel requests={eligibleResult.data} />
      ) : null}

      {quotesResult.status === "error" || quotesResult.status === "unavailable" ? (
        <QueryStateNotice result={quotesResult} />
      ) : quotesResult.status === "empty" ? (
        <QueryStateNotice
          result={quotesResult}
          emptyMessage="No quotes match the current filter."
        />
      ) : (
        <QuotesListTable quotes={quotesResult.data} />
      )}
    </div>
  );
}

export default async function AdminQuotesPage({
  searchParams,
}: {
  searchParams: Promise<QuoteListFilters>;
}) {
  await requireAdmin();
  const filters = await searchParams;

  return (
    <AdminPage
      title="Quotes"
      description="Create and version quotes from reviewed project requests. A project is created only after the client accepts a quote."
      className="mx-auto w-full max-w-6xl"
    >
      <QuotesToolbar filters={filters} />
      <Suspense fallback={<QuotesListSkeleton />}>
        <QuotesContent filters={filters} />
      </Suspense>
    </AdminPage>
  );
}
