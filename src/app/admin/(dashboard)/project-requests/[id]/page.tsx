import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminPage } from "@/components/admin/admin-page";
import { ProjectRequestDetail } from "@/components/admin/project-requests/project-request-detail";
import { QueryStateNotice, StatusPill } from "@/components/admin/projects/query-state";
import {
  formatDateTime,
  formatRequestStatusLabel,
  getAdminProjectRequest,
  getRequestStatusStyle,
} from "@/lib/admin-project-requests";
import type { ProjectRequestQuoteSummary } from "@/lib/admin-project-request-constants";
import { requireAdmin } from "@/lib/require-admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function AdminProjectRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const result = await getAdminProjectRequest(id);

  if (result.status === "empty") {
    notFound();
  }

  if (result.status === "error" || result.status === "unavailable") {
    return (
      <AdminPage
        title="Project request"
        description="Could not load this request."
        className="mx-auto w-full max-w-6xl"
      >
        <QueryStateNotice result={result} />
      </AdminPage>
    );
  }

  const request = result.data;

  let quotes: ProjectRequestQuoteSummary[] = [];
  if (request.linkedProject) {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase
      .from("quotes")
      .select("id, version, status, total, currency, created_at, updated_at")
      .eq("project_id", request.linkedProject.id)
      .order("version", { ascending: false });
    quotes = (data ?? []) as ProjectRequestQuoteSummary[];
  }

  return (
    <AdminPage
      title={request.request_number}
      description={`Submitted ${formatDateTime(request.submitted_at)} by ${request.full_name}`}
      className="mx-auto w-full max-w-6xl"
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/admin/project-requests"
          className="text-sm text-muted hover:text-foreground"
        >
          Back to all requests
        </Link>
        <StatusPill
          label={formatRequestStatusLabel(request.status)}
          className={getRequestStatusStyle(request.status)}
        />
      </div>
      <ProjectRequestDetail request={request} quotes={quotes} />
    </AdminPage>
  );
}
