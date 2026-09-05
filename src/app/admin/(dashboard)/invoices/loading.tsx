import { AdminPage } from "@/components/admin/admin-page";
import { InvoicesListSkeleton } from "@/components/admin/invoices/invoices-skeleton";

export default function AdminInvoicesLoading() {
  return (
    <AdminPage
      title="Invoices"
      description="Loading invoices from Supabase."
      className="mx-auto w-full max-w-6xl"
    >
      <InvoicesListSkeleton />
    </AdminPage>
  );
}
