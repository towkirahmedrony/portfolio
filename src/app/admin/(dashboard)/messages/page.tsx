import Link from "next/link";
import { AdminPage } from "@/components/admin/admin-page";
import { clientDisplayName, formatDateTime } from "@/lib/admin-projects";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ProjectMessageRow } from "@/types/database";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Conversation = {
  projectId: string;
  projectNumber: string;
  title: string;
  clientName: string;
  clientId: string;
  latestMessage: string;
  latestAt: string;
  unreadCount: number;
};

function preview(message: string): string {
  const singleLine = message.replace(/\s+/g, " ").trim();
  return singleLine.length > 120 ? `${singleLine.slice(0, 120)}…` : singleLine;
}

/**
 * Admin messages hub — one conversation per project, reusing the existing
 * project_messages table (no duplicate messaging store). Each conversation is
 * project-scoped; opening one goes to that project's realtime chat tab. Read
 * state here mirrors the database (is_read), the same state the client sees.
 */
export default async function AdminMessagesPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: rows, error } = await supabase
    .from("project_messages")
    .select("id, project_id, sender_id, message, is_read, created_at")
    .order("created_at", { ascending: false })
    .limit(500);

  const messages = (rows ?? []) as ProjectMessageRow[];

  const projectIds = [
    ...new Set(messages.map((row) => row.project_id).filter((id): id is string => id !== null)),
  ];
  const { data: projects } = projectIds.length
    ? await supabase
        .from("projects")
        .select("id, project_number, title, client_id")
        .in("id", projectIds)
    : { data: [] };

  const clientIds = [
    ...new Set(
      (projects ?? [])
        .map((project) => project.client_id)
        .filter((id): id is string => id !== null),
    ),
  ];
  const { data: profiles } = clientIds.length
    ? await supabase
        .from("profiles")
        .select("id, full_name, display_name")
        .in("id", clientIds)
    : { data: [] };

  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const projectById = new Map((projects ?? []).map((project) => [project.id, project]));

  const conversationsByProject = new Map<string, Conversation>();
  for (const message of messages) {
    if (!message.project_id) {
      continue;
    }
    const project = projectById.get(message.project_id);
    if (!project) {
      continue;
    }
    const current = conversationsByProject.get(project.id);
    if (!current) {
      const profile = project.client_id ? profileById.get(project.client_id) : undefined;
      conversationsByProject.set(project.id, {
        projectId: project.id,
        projectNumber: project.project_number,
        title: project.title,
        clientName: clientDisplayName({
          id: project.client_id,
          full_name: profile?.full_name ?? "",
          display_name: profile?.display_name ?? null,
          company_name: null,
          avatar_url: null,
        }),
        clientId: project.client_id ?? "",
        latestMessage: message.message,
        latestAt: message.created_at,
        unreadCount: 0,
      });
    } else if (message.created_at > current.latestAt) {
      current.latestMessage = message.message;
      current.latestAt = message.created_at;
    }
    if (user && !message.is_read && message.sender_id !== user.id) {
      // Any message not written by the viewing admin counts as incoming.
      const conversation = conversationsByProject.get(project.id);
      if (conversation) {
        conversation.unreadCount += 1;
      }
    }
  }

  const conversations = [...conversationsByProject.values()].sort((a, b) =>
    a.latestAt < b.latestAt ? 1 : -1,
  );

  return (
    <AdminPage
      title="Project Messages"
      description="Client and admin conversations, grouped by project. Each project has its own conversation."
      className="mx-auto w-full max-w-5xl"
    >
      {error ? (
        <div className="rounded-3xl border border-red-500/20 bg-red-500/5 p-6 text-sm text-red-600">
          Could not load conversations: {error.message}
        </div>
      ) : conversations.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-card-border bg-card p-10 text-center">
          <p className="text-sm font-medium text-foreground">No project messages yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">
            When a client messages you from a project, the conversation appears
            here. You can also open any project and use its Messages tab.
          </p>
          <Link
            href="/admin/projects"
            className="mt-5 inline-flex items-center justify-center rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            Browse projects
          </Link>
        </div>
      ) : (
        <div className="grid gap-3">
          {conversations.map((conversation) => (
            <Link
              key={conversation.projectId}
              href={`/admin/projects/${conversation.projectId}?tab=messages`}
              className="flex items-center gap-4 rounded-2xl border border-card-border bg-card p-4 transition-colors hover:border-accent/30 sm:p-5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold tracking-wider text-accent uppercase">
                    {conversation.projectNumber}
                  </span>
                  {conversation.unreadCount > 0 ? (
                    <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-accent-foreground">
                      {conversation.unreadCount} new
                    </span>
                  ) : null}
                </div>
                <h2 className="mt-1 truncate font-display text-base font-medium tracking-tight text-foreground">
                  {conversation.title}
                </h2>
                <p className="mt-1 truncate text-sm text-muted">
                  <span className="font-medium text-foreground/80">{conversation.clientName}</span>
                  {" · "}
                  {preview(conversation.latestMessage) || "No message body"}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="text-xs text-muted">
                  {formatDateTime(conversation.latestAt)}
                </span>
                <span className="text-xs font-medium text-accent">Open chat &rarr;</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </AdminPage>
  );
}
