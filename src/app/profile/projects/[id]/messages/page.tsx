import { notFound, redirect } from "next/navigation";
import { ProjectChat } from "@/components/project-chat/project-chat";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Client-side project conversation.
 *
 * The route is keyed by the project's existing id. The conversation is
 * derived server-side from the authenticated session: the project must exist
 * AND belong to the signed-in client (client_id = auth user), otherwise the
 * page 404s. The browser never supplies sender/ownership claims — RLS and the
 * send_project_message RPC enforce them in the database.
 */
export default async function ProjectMessagesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = await params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: project } = await supabase
    .from("projects")
    .select("id, project_number, title, client_id, status")
    .eq("id", projectId)
    .eq("client_id", user.id)
    .maybeSingle();

  if (!project || project.client_id !== user.id) {
    notFound();
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, display_name")
    .eq("id", user.id)
    .maybeSingle();

  const clientName = profile?.display_name || profile?.full_name || "Client";

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col px-2 pt-[4.25rem] pb-0 sm:px-8 sm:pt-28 sm:pb-10">
      {/* Slim context line on desktop only — on mobile the chat header (back,
          reference + title) provides the full app-like context. */}
      <div className="mb-4 hidden items-end justify-between gap-3 sm:flex">
        <div>
          <p className="text-xs font-semibold tracking-wider text-accent uppercase">
            {project.project_number}
          </p>
          <h1 className="font-display mt-1 text-3xl tracking-tight">
            Project messages
          </h1>
        </div>
        <p className="text-xs text-muted">
          Live conversation about this project with the team
        </p>
      </div>

      <ProjectChat
        projectId={project.id}
        projectNumber={project.project_number}
        projectTitle={project.title}
        clientId={user.id}
        clientName={clientName}
        backHref="/profile/messages"
        backLabel="Back"
        detailsHref={`/profile/projects/${project.id}`}
        allowSendMessages={project.status !== "cancelled"}
        className="h-[calc(100dvh_-_4.5rem)] min-h-[22rem] sm:h-[min(76vh,44rem)] sm:min-h-[30rem]"
      />
    </div>
  );
}
