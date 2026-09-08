import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/admin/projects/action-form";
import { AdminPanel, QueryStateNotice } from "@/components/admin/projects/query-state";
import { sendProjectMessage } from "@/lib/admin-project-actions";
import {
  clientDisplayName,
  formatDateTime,
  type ProjectClient,
  type QueryResult,
} from "@/lib/admin-projects";
import type { ProjectQuoteChangeRequestsResult } from "@/lib/admin-quote-responses";
import type { ProjectMessageRow } from "@/types/database";

const fieldClass =
  "w-full rounded-xl border border-card-border bg-background px-3 py-2 text-sm text-foreground";

type MessageWithSender = ProjectMessageRow & { sender: ProjectClient | null };

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
      description="Open change requests on quotes for this project. Reply below — the message is sent to the client on this project's thread."
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
                <span className="text-xs text-muted">
                  {formatDateTime(request.changeRequestedAt)}
                </span>
              </div>
              {request.message ? (
                <p className="mt-2 whitespace-pre-line rounded-xl bg-background/70 px-3 py-2 text-sm leading-6 text-foreground">
                  {request.message}
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Link
                  href={`/admin/quotes/${request.quoteId}`}
                  className="text-xs font-medium text-amber-700 hover:underline dark:text-amber-400"
                >
                  Open quote v{request.quoteVersion}
                </Link>
                <span className="text-xs text-muted">
                  Client is waiting — revise the quote or reply below.
                </span>
              </div>
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

export function ProjectMessagesTab({
  projectId,
  result,
  changeRequests,
}: {
  projectId: string;
  result: QueryResult<MessageWithSender[]>;
  changeRequests?: ProjectQuoteChangeRequestsResult;
}) {
  if (result.status === "error" || result.status === "unavailable") {
    return <QueryStateNotice result={result} />;
  }

  const messages = result.status === "empty" ? [] : result.data;
  const byId = new Map(messages.map((message) => [message.id, message]));

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 space-y-6">
        {changeRequests ? (
          <QuoteChangeRequestsPanel projectId={projectId} changeRequests={changeRequests} />
        ) : null}
        <AdminPanel
          title="Message thread"
          description="Client and admin messages from project_messages."
        >
          {messages.length === 0 ? (
            <QueryStateNotice
              result={{ status: "empty", data: [] }}
              emptyMessage="No messages yet."
            />
          ) : (
            <div className="space-y-3">
              {messages.map((message) => {
                const replyTo = message.reply_to_id ? byId.get(message.reply_to_id) : null;
                return (
                  <article
                    key={message.id}
                    className="rounded-2xl border border-card-border bg-background p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                      <span className="font-medium text-foreground">
                        {clientDisplayName(message.sender)}
                      </span>
                      <span>{formatDateTime(message.created_at)}</span>
                    </div>
                    {replyTo ? (
                      <p className="mt-2 rounded-xl bg-card px-3 py-2 text-xs text-muted">
                        Replying to {clientDisplayName(replyTo.sender)}: {replyTo.message}
                      </p>
                    ) : null}
                    <p className="mt-2 whitespace-pre-line text-sm text-foreground">{message.message}</p>
                    <ActionForm action={sendProjectMessage} className="mt-3 grid gap-2">
                      <input type="hidden" name="projectId" value={projectId} />
                      <input type="hidden" name="replyToId" value={message.id} />
                      <input
                        name="message"
                        required
                        placeholder={`Reply to ${clientDisplayName(message.sender)}`}
                        className={fieldClass}
                      />
                      <SubmitButton variant="secondary">Reply</SubmitButton>
                    </ActionForm>
                  </article>
                );
              })}
            </div>
          )}
        </AdminPanel>
      </div>

      <AdminPanel title="Send message">
        <ActionForm
          action={sendProjectMessage}
          className="grid gap-3"
          successMessage="Message sent."
        >
          <input type="hidden" name="projectId" value={projectId} />
          <textarea name="message" required rows={6} placeholder="Write a message" className={fieldClass} />
          <SubmitButton>Send</SubmitButton>
        </ActionForm>
      </AdminPanel>
    </div>
  );
}
