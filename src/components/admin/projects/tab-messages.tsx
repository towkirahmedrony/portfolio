import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/admin/projects/action-form";
import { AdminPanel, QueryStateNotice } from "@/components/admin/projects/query-state";
import { ProjectChat } from "@/components/project-chat/project-chat";
import { sendProjectMessage } from "@/lib/admin-project-actions";
import {
  clientDisplayName,
  type AdminProjectListItem,
} from "@/lib/admin-projects";
import type { ProjectQuoteChangeRequestsResult } from "@/lib/admin-quote-responses";

const fieldClass =
  "w-full rounded-xl border border-card-border bg-background px-3 py-2 text-sm text-foreground";

function QuoteChangeRequestsPanel({
  projectId,
  changeRequests,
}: {
  projectId: string;
  changeRequests: ProjectQuoteChangeRequestsResult;
}) {
  if (changeRequests.status === "error" || changeRequests.status === "unavailable") {
    return <QueryStateNotice result={changeRequests} />;
  }
  if (changeRequests.status === "empty") {
    return null;
  }

  return (
    <AdminPanel
      title="Client requested quote changes"
      description="Open change requests on quotes for this project. Reply below — the message is sent to the client on this project's conversation."
    >
      <div className="grid gap-4">
        {changeRequests.items.map((request) => {
          const reference = [request.projectNumber, request.requestNumber]
            .filter(Boolean)
            .join(" · ");
          return (
            <article
              key={request.quoteId}
              className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">
                  Quote v{request.quoteVersion}
                  {reference ? <span className="text-muted"> · {reference}</span> : null}
                </p>
                <Link
                  href={`/admin/quotes/${request.quoteId}`}
                  className="text-xs font-medium text-amber-700 hover:underline dark:text-amber-400"
                >
                  Open quote v{request.quoteVersion}
                </Link>
              </div>
              {request.message ? (
                <p className="mt-2 whitespace-pre-line rounded-xl bg-background/70 px-3 py-2 text-sm leading-6 text-foreground">
                  {request.message}
                </p>
              ) : null}
              <ActionForm
                action={sendProjectMessage}
                className="mt-3 grid gap-2"
                successMessage="Message sent to the client."
              >
                <input type="hidden" name="projectId" value={projectId} />
                {request.threadMessageId ? (
                  <input type="hidden" name="replyToId" value={request.threadMessageId} />
                ) : null}
                <textarea
                  name="message"
                  required
                  rows={3}
                  placeholder={`Message client about quote v${request.quoteVersion} changes…`}
                  className={fieldClass}
                />
                <SubmitButton variant="secondary">
                  Message client about quote changes
                </SubmitButton>
              </ActionForm>
            </article>
          );
        })}
      </div>
    </AdminPanel>
  );
}

/**
 * Admin view of the project conversation (tab on the Admin project details
 * page). The thread itself is the realtime ProjectChat component shared with
 * the client — every message written here goes through send_project_message
 * (auth.uid() = sender, is_active_admin() enforced in the database) and is
 * streamed to the client over Supabase Realtime.
 */
export function ProjectMessagesTab({
  project,
  changeRequests,
}: {
  project: AdminProjectListItem;
  changeRequests?: ProjectQuoteChangeRequestsResult;
}) {
  const clientId = project.client_id;
  const clientName = clientDisplayName(project.client);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0">
        <ProjectChat
          projectId={project.id}
          projectNumber={project.project_number}
          projectTitle={project.title}
          clientId={clientId}
          clientName={clientName}
          backHref={`/admin/projects/${project.id}?tab=overview`}
          backLabel="Project overview"
          className="h-[min(78vh,46rem)] min-h-[30rem]"
        />
      </div>

      <div className="min-w-0 space-y-6">
        {changeRequests ? (
          <QuoteChangeRequestsPanel projectId={project.id} changeRequests={changeRequests} />
        ) : null}
        <AdminPanel title="About this conversation">
          <p className="text-sm leading-6 text-muted">
            This conversation is attached to {project.project_number} and belongs to{" "}
            <span className="font-medium text-foreground">{clientName}</span>. Messages
            appear in real time on the client&apos;s project page — no refresh needed.
          </p>
        </AdminPanel>
      </div>
    </div>
  );
}
