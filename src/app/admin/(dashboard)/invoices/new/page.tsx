import Link from "next/link";
import { AdminPage } from "@/components/admin/admin-page";
import { QueryStateNotice } from "@/components/admin/projects/query-state";
import { CreateInvoiceFromQuote } from "@/components/admin/invoices/create-from-quote";
import { getAcceptedQuoteOptions } from "@/lib/admin-invoices";
import { requireAdmin } from "@/lib/require-admin";

export default async function AdminNewInvoicePage() {
  await requireAdmin();
  const quotes = await getAcceptedQuoteOptions();

  return (
    <AdminPage
      title="Create invoice"
      description="Create a draft invoice from an accepted quote. Totals are copied from quote_items."
      className="mx-auto w-full max-w-6xl"
    >
      <Link
        href="/admin/invoices"
        className="mb-6 inline-block text-sm text-muted hover:text-foreground"
      >
        Back to all invoices
      </Link>
      {quotes.status === "error" || quotes.status === "unavailable" ? (
        <QueryStateNotice result={quotes} />
      ) : quotes.status === "empty" ? (
        <QueryStateNotice
          result={quotes}
          emptyMessage="No unused accepted quotes are available. Accept a quote first."
        />
      ) : (
        <CreateInvoiceFromQuote quotes={quotes.data} />
      )}
    </AdminPage>
  );
}
