import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminPage } from "@/components/admin/admin-page";
import { ServiceFeaturesEditor } from "@/components/admin/content/service-features-editor";
import { ServiceForm } from "@/components/admin/content/service-form";
import { QueryStateNotice } from "@/components/admin/projects/query-state";
import { getAdminService } from "@/lib/admin-content";
import { requireAdmin } from "@/lib/require-admin";

export default async function AdminServiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const result = await getAdminService(id);

  if (result.status === "empty") {
    notFound();
  }

  if (result.status === "error" || result.status === "unavailable") {
    return (
      <AdminPage
        title="Service"
        description="Could not load this service."
        className="mx-auto w-full max-w-6xl"
      >
        <QueryStateNotice result={result} />
      </AdminPage>
    );
  }

  const service = result.data;

  if (!service) {
    notFound();
  }

  return (
    <AdminPage
      title={service.name}
      description={`Slug: ${service.slug}`}
      className="mx-auto w-full max-w-6xl"
    >
      <Link
        href="/admin/services"
        className="mb-6 inline-block text-sm text-muted hover:text-foreground"
      >
        Back to services
      </Link>
      <div className="space-y-6">
        <ServiceForm service={service} isNew={false} />
        <ServiceFeaturesEditor serviceId={service.id} features={service.features} />
      </div>
    </AdminPage>
  );
}
