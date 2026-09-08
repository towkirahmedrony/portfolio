import { notFound } from "next/navigation";
import { ProjectChat } from "@/components/project-chat/project-chat";
import { clientDisplayName, getAdminProject } from "@/lib/admin-projects";
import { requireAdmin } from "@/lib/require-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Full-screen Admin project conversation.
 *
 * Same ProjectChat the Client uses and the same project_messages rows as the
 * in-page Messages tab. Routed through the Chat layout so Quote / Project
 * Details chrome never wrap the conversation.
 */
export default async function AdminProjectMessagesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAdmin();
  const { id: projectId } = await params;
  const result = await getAdminProject(projectId);

  if (result.status === "empty") {
    notFound();
  }

  if (result.status === "error" || result.status === "unavailable") {
    return (
      <div className="flex h-svh items-center justify-center px-6 text-center">
        <p className="text-sm text-muted">
          {result.status === "unavailable"
            ? "This project is not available in the current database schema."
            : result.message ?? "Could not load this conversation."}
        </p>
      </div>
    );
  }

  const project = result.data;

  return (
    <ProjectChat
      projectId={project.id}
      projectNumber={project.project_number}
      projectTitle={project.title}
      clientId={project.client_id}
      clientName={clientDisplayName(project.client)}
      backHref={`/admin/projects/${project.id}`}
      backLabel="Back"
      detailsHref={`/admin/projects/${project.id}`}
      allowSendMessages={project.status !== "cancelled"}
      knownViewer={{ id: user.id, isAdmin: true }}
      fillViewport
    />
  );
}
