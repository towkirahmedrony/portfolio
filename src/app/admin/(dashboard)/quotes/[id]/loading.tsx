import { AdminPage } from "@/components/admin/admin-page";
import { QuoteDetailSkeleton } from "@/components/admin/quotes/quotes-skeleton";

export default function AdminQuoteDetailLoading() {
  return (
    <AdminPage
      title="Quote"
      description="Loading quote details."
      className="mx-auto w-full max-w-6xl"
    >
      <QuoteDetailSkeleton />
    </AdminPage>
  );
}
