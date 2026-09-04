import { AdminPage } from "@/components/admin/admin-page";
import { InvoiceDetailSkeleton } from "@/components/admin/invoices/invoices-skeleton";

export default function AdminInvoiceDetailLoading() {
  return (
    <AdminPage
      title="Invoice"
      description="Loading invoice details."
      className="mx-auto w-full max-w-6xl"
    >
      <InvoiceDetailSkeleton />
    </AdminPage>
  );
}
