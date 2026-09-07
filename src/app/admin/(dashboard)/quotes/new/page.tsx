import Link from "next/link";
import { AdminPage } from "@/components/admin/admin-page";
import { QueryStateNotice } from "@/components/admin/projects/query-state";
import { QuoteEditor } from "@/components/admin/quotes/quote-editor";
import { getQuoteEligibleProjectRequests } from "@/lib/admin-quotes";
import { requireAdmin } from "@/lib/require-admin";

export default async function AdminNewQuotePage({
  searchParams,
}: {
  searchParams: Promise<{ requestId?: string }>;
}) {
  await requireAdmin();
  const { requestId } = await searchParams;
  const requests = await getQuoteEligibleProjectRequests();

  return (
    <AdminPage
      title="New quote"
      description="Draft a quote from a reviewed project request. Saving never creates a project."
      className="mx-auto w-full max-w-6xl"
    >
      <Link
        href="/admin/quotes"
        className="mb-6 inline-block text-sm text-muted hover:text-foreground"
      >
        Back to all quotes
      </Link>
      {requests.status === "error" || requests.status === "unavailable" ? (
        <QueryStateNotice result={requests} />
      ) : requests.status === "empty" ? (
        <QueryStateNotice
          result={requests}
          emptyMessage="No reviewed project requests are ready to quote. Move a request to reviewing first."
        />
      ) : (
        <QuoteEditor requests={requests.data} preselectedRequestId={requestId} />
      )}
    </AdminPage>
  );
}
