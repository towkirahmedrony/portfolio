import { notFound, redirect } from "next/navigation";
import { ProjectChat } from "@/components/project-chat/project-chat";
import { canClientMessageRequest } from "@/lib/request-messaging";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Client conversation for a Project Request (pre-project stage).
 *
 * The conversation rows live in the existing project_messages table scoped by
 * request_id. When the request converts into a project (quote accepted), the
 * database relinks those rows to the project — so this page redirects to the
 * project chat, which shows the SAME history (same rows, same ids).
 *
 * Ownership is checked server-side (request.client_id = auth user); eligibility
 * to send follows the request status. Admins reach the same conversation from
 * /admin/project-requests/[id]/messages.
 */
export default async function ProjectRequestMessagesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: requestId } = await params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: request } = await supabase
    .from("project_requests")
    .select("id, request_number, project_type, status, client_id")
    .eq("id", requestId)
    .eq("client_id", user.id)
    .maybeSingle();

  if (!request || request.client_id !== user.id) {
    notFound();
  }

  // Conversation continuity: once a project exists for this request, the
  // request-stage messages already belong to that project. Open the project
  // chat — never a second conversation.
  const { data: linkedProject } = await supabase
    .from("projects")
    .select("id, project_number, title")
    .eq("request_id", requestId)
    .maybeSingle();

  if (linkedProject) {
    redirect(`/profile/projects/${linkedProject.id}/messages`);
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-5 pt-24 pb-10 sm:px-8 sm:pt-28">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-wider text-accent uppercase">
            {request.request_number}
          </p>
          <h1 className="font-display mt-1 text-2xl tracking-tight sm:text-3xl">
            Request messages
          </h1>
        </div>
        <p className="text-xs text-muted">
          {canClientMessageRequest(request.status)
            ? "Live conversation with the team about your request"
            : "This conversation is no longer open for new messages"}
        </p>
      </div>

      <ProjectChat
        requestId={request.id}
        projectNumber={request.request_number}
        projectTitle={request.project_type || "Project request"}
        clientId={user.id}
        clientName="Client"
        backHref={`/profile/project-requests/${request.id}`}
        backLabel="Request details"
        allowSendMessages={canClientMessageRequest(request.status)}
      />
    </div>
  );
}
