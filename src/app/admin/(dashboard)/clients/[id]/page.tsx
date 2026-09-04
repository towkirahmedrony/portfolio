import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminPage } from "@/components/admin/admin-page";
import { ClientAccountCard } from "@/components/admin/clients/client-account-card";
import { ClientSummaryPanels } from "@/components/admin/clients/client-summary-panels";
import { QueryStateNotice } from "@/components/admin/projects/query-state";
import { getAdminClient, getAdminClientRelatedData } from "@/lib/admin-clients";
import { requireAdmin } from "@/lib/require-admin";

export default async function AdminClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const clientResult = await getAdminClient(id);

  if (clientResult.status === "empty") {
    notFound();
  }

  if (clientResult.status === "error" || clientResult.status === "unavailable") {
    return (
      <AdminPage
        title="Client"
        description="Could not load this client."
        className="mx-auto w-full max-w-6xl"
      >
        <QueryStateNotice result={clientResult} />
      </AdminPage>
    );
  }

  const client = clientResult.data;

  if (!client) {
    notFound();
  }

  const related = await getAdminClientRelatedData(client.id);

  return (
    <AdminPage
      title={client.full_name || "Client account"}
      description={client.email ?? "Client profile"}
      className="mx-auto w-full max-w-6xl"
    >
      <Link
        href="/admin/clients"
        className="mb-6 inline-block text-sm text-muted hover:text-foreground"
      >
        Back to all clients
      </Link>
      <ClientAccountCard client={client} />
      <ClientSummaryPanels data={related} clientId={client.id} />
    </AdminPage>
  );
}
