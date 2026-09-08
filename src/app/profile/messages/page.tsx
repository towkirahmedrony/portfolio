import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Conversation = {
  projectId: string;
  projectNumber: string;
  projectTitle: string;
  latest: string;
  latestAt: string;
  unread: number;
};

function preview(message: string): string {
  const singleLine = message.replace(/\s+/g, " ").trim();
  return singleLine.length > 120 ? `${singleLine.slice(0, 120)}…` : singleLine;
}

function whenLabel(iso: string): string {
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) {
    return "Just now";
  }
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.round(hours / 24);
  if (days < 7) {
    return `${days}d ago`;
  }
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/**
 * Client Messages hub — one conversation per project, using only the client's
 * own projects (RLS-scoped to projects.client_id = current user). Every row
 * opens the project's existing chat route; no duplicate messaging store.
 */
export default async function ProfileMessagesPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: projects, error: projectsError } = await supabase
    .from("projects")
    .select("id, project_number, title")
    .eq("client_id", user.id)
    .order("created_at", { ascending: false });

  if (projectsError) {
    notFound();
  }
  const projectList = projects ?? [];
  const projectIds = projectList.map((project) => project.id);
  const projectById = new Map(projectList.map((project) => [project.id, project]));

  const { data: messageRows } = projectIds.length
    ? await supabase
        .from("project_messages")
        .select("id, project_id, sender_id, message, is_read, created_at")
        .in("project_id", projectIds)
        .order("created_at", { ascending: false })
        .limit(300)
    : { data: [] };

  const messages = messageRows ?? [];
  const groups = new Map<string, Conversation>();
  for (const message of messages) {
    const project = projectById.get(message.project_id);
    if (!project) {
      continue;
    }
    const existing = groups.get(message.project_id);
    if (existing) {
      if (!message.is_read && message.sender_id !== user.id) {
        existing.unread += 1;
      }
    } else {
      groups.set(message.project_id, {
        projectId: project.id,
        projectNumber: project.project_number,
        projectTitle: project.title,
        latest: preview(message.message),
        latestAt: message.created_at,
        unread: !message.is_read && message.sender_id !== user.id ? 1 : 0,
      });
    }
  }

  const conversations = [...groups.values()].sort((a, b) =>
    a.latestAt < b.latestAt ? 1 : -1,
  );
  const totalUnread = conversations.reduce((sum, row) => sum + row.unread, 0);

  return (
    <div className="mx-auto w-full max-w-4xl px-5 pt-24 pb-12 sm:px-8 sm:pt-28">
      <Link
        href="/profile"
        className="mb-6 inline-block text-sm text-muted hover:text-foreground"
      >
        &larr; Back to Profile
      </Link>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-wider text-accent uppercase">
            Messages
          </p>
          <h1 className="font-display mt-1 text-2xl tracking-tight sm:text-3xl">
            Your project messages
          </h1>
        </div>
        <p className="text-xs text-muted">
          {totalUnread > 0
            ? `${totalUnread} unread ${totalUnread === 1 ? "message" : "messages"}`
            : "No unread messages"}
        </p>
      </div>

      {conversations.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-card-border bg-card p-10 text-center">
          <p className="text-sm font-medium text-foreground">
            No project conversations yet
          </p>
          <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-muted">
            When you or the team send a message on a project, it appears here.
            You can also open any of your active projects and use its Messages
            chat.
          </p>
          <Link
            href="/profile"
            className="mt-5 inline-flex items-center justify-center rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            Go to your profile
          </Link>
        </div>
      ) : (
        <div className="grid gap-3">
          {conversations.map((conversation) => (
            <Link
              key={conversation.projectId}
              href={`/profile/projects/${conversation.projectId}/messages`}
              className="flex items-center gap-4 rounded-2xl border border-card-border bg-card p-4 transition-colors hover:border-accent/30 sm:p-5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold tracking-wider text-accent uppercase">
                    {conversation.projectNumber}
                  </span>
                  {conversation.unread > 0 ? (
                    <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-accent-foreground">
                      {conversation.unread} new
                    </span>
                  ) : null}
                  <span className="text-xs text-muted">
                    {whenLabel(conversation.latestAt)}
                  </span>
                </div>
                <h2 className="mt-1 truncate font-display text-base font-medium tracking-tight text-foreground">
                  {conversation.projectTitle}
                </h2>
                <p className="mt-1 truncate text-sm text-muted">
                  {conversation.latest}
                </p>
              </div>
              <span className="shrink-0 text-sm font-medium text-accent">
                Open chat &rarr;
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
