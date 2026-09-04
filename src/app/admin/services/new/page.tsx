import Link from "next/link";
import { AdminPage } from "@/components/admin/admin-page";
import { ServiceForm } from "@/components/admin/content/service-form";
import { requireAdmin } from "@/lib/require-admin";

export default async function AdminServiceNewPage() {
  await requireAdmin();

  return (
    <AdminPage
      title="Add service"
      description="Create a new service. Slug, pricing and duration are validated on save."
      className="mx-auto w-full max-w-6xl"
    >
      <Link
        href="/admin/services"
        className="mb-6 inline-block text-sm text-muted hover:text-foreground"
      >
        Back to services
      </Link>
      <ServiceForm isNew service={null} />
    </AdminPage>
  );
}
