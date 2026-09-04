import { AdminPage } from "@/components/admin/admin-page";
import { QuotesListSkeleton } from "@/components/admin/quotes/quotes-skeleton";

export default function AdminQuotesLoading() {
  return (
    <AdminPage
      title="Quotes"
      description="Loading quotes from Supabase."
      className="mx-auto w-full max-w-6xl"
    >
      <QuotesListSkeleton />
    </AdminPage>
  );
}
