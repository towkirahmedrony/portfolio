import { notFound, redirect } from "next/navigation";
import { ProjectChat } from "@/components/project-chat/project-chat";
import { clientDisplayName } from "@/lib/admin-projects";
import { getAdminProjectRequest } from "@/lib/admin-project-requests";
import { requireAdmin } from "@/lib/require-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Admin view of a Project Request conversation (pre-project stage).
 *
 * Lives in the Chat route group so Quote Details / Request Details chrome
 * never wrap the conversation. Same project_messages rows the Client sees;
 * when the request converts, those rows are relinked to the project and this
 * page redirects to the project chat (conversation continuity).
 */
export default async function AdminProjectRequestMessagesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAdmin();
  const { id: requestId } = await params;
  const result = await getAdminProjectRequest(requestId);

  if (result.status === "empty") {
    notFound();
  }

  if (result.status === "error" || result.status === "unavailable") {
    return (
      <div className="flex h-svh items-center justify-center px-6 text-center">
        <p className="text-sm text-muted">
          {result.status === "unavailable"
            ? "This request is not available in the current database schema."
            : result.message ?? "Could not load this conversation."}
        </p>
      </div>
    );
  }

  const request = result.data;

  if (request.linkedProject) {
    redirect(`/admin/projects/${request.linkedProject.id}/messages`);
  }

  const clientName =
    clientDisplayName(request.client) === "Unknown client"
      ? request.full_name || "Client"
      : clientDisplayName(request.client);

  return (
    <ProjectChat
      requestId={request.id}
      projectNumber={request.request_number}
      projectTitle={request.project_type || "Project request"}
      clientId={request.client_id ?? ""}
      clientName={clientName}
      backHref={`/admin/project-requests/${request.id}`}
      backLabel="Back"
      detailsHref={`/admin/project-requests/${request.id}`}
      knownViewer={{ id: user.id, isAdmin: true }}
      fillViewport
    />
  );
}
