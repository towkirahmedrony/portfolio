import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminPage } from "@/components/admin/admin-page";
import { ProjectChat } from "@/components/project-chat/project-chat";
import { getAdminProjectRequest } from "@/lib/admin-project-requests";
import { requireAdmin } from "@/lib/require-admin";

/**
 * Admin view of a Project Request conversation (pre-project stage).
 *
 * Same conversation the Client sees on the request — same project_messages
 * rows scoped by request_id. When the request converts to a project, the
 * rows are relinked to the project by the database and this same history
 * appears in the project's Messages tab. Admins can reply at any stage.
 */
export default async function AdminProjectRequestMessagesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id: requestId } = await params;
  const result = await getAdminProjectRequest(requestId);

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
        <p className="text-sm text-muted">
          {result.status === "unavailable"
            ? "This request is not available in the current database schema."
            : result.message ?? "Something went wrong."}
        </p>
      </AdminPage>
    );
  }

  const request = result.data;

  return (
    <AdminPage
      title={`${request.request_number} · Messages`}
      description={request.project_type || "Project request"}
      className="mx-auto w-full max-w-5xl"
    >
      <Link
        href={`/admin/project-requests/${request.id}`}
        className="mb-6 inline-block text-sm text-muted hover:text-foreground"
      >
        &larr; Back to request
      </Link>
      <ProjectChat
        requestId={request.id}
        projectNumber={request.request_number}
        projectTitle={request.project_type || "Project request"}
        clientId={request.client_id ?? ""}
        clientName={request.full_name || "Client"}
        backHref={`/admin/project-requests/${request.id}`}
        backLabel="Back to request"
        className="h-[min(76vh,46rem)] min-h-[30rem]"
      />
    </AdminPage>
  );
}
