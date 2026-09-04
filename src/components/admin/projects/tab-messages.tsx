import { ActionForm, SubmitButton } from "@/components/admin/projects/action-form";
import { AdminPanel, QueryStateNotice } from "@/components/admin/projects/query-state";
import { sendProjectMessage } from "@/lib/admin-project-actions";
import {
  clientDisplayName,
  formatDateTime,
  type ProjectClient,
  type QueryResult,
} from "@/lib/admin-projects";
import type { ProjectMessageRow } from "@/types/database";

const fieldClass =
  "w-full rounded-xl border border-card-border bg-background px-3 py-2 text-sm text-foreground";

type MessageWithSender = ProjectMessageRow & { sender: ProjectClient | null };

export function ProjectMessagesTab({
  projectId,
  result,
}: {
  projectId: string;
  result: QueryResult<MessageWithSender[]>;
}) {
  if (result.status === "error" || result.status === "unavailable") {
    return <QueryStateNotice result={result} />;
  }

  const messages = result.status === "empty" ? [] : result.data;
  const byId = new Map(messages.map((message) => [message.id, message]));

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
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
