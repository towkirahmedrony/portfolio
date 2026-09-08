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
    .select("id, project_number, title, client_id")
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
    <div className="mx-auto w-full max-w-4xl px-5 pt-24 pb-10 sm:px-8 sm:pt-28">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-wider text-accent uppercase">
            {project.project_number}
          </p>
          <h1 className="font-display mt-1 text-2xl tracking-tight sm:text-3xl">
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
        backHref={`/profile/projects/${project.id}`}
        backLabel="Project details"
      />
    </div>
  );
}
