import { ActionForm, SubmitButton } from "@/components/admin/projects/action-form";
import { AdminPanel, QueryStateNotice, StatusPill } from "@/components/admin/projects/query-state";
import { createProjectNote, updateProjectNote } from "@/lib/admin-project-actions";
import {
  clientDisplayName,
  formatDateTime,
  type ProjectClient,
  type QueryResult,
} from "@/lib/admin-projects";
import type { ProjectNoteRow } from "@/types/database";

const fieldClass =
  "w-full rounded-xl border border-card-border bg-background px-3 py-2 text-sm text-foreground";

type NoteWithAuthor = ProjectNoteRow & { author: ProjectClient | null };

export function ProjectNotesTab({
  projectId,
  result,
}: {
  projectId: string;
  result: QueryResult<NoteWithAuthor[]>;
}) {
  if (result.status === "error" || result.status === "unavailable") {
    return <QueryStateNotice result={result} />;
  }

  const notes = result.status === "empty" ? [] : result.data;
  const internalNotes = notes.filter((note) => note.is_internal);
  const clientNotes = notes.filter((note) => !note.is_internal);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-6">
        <AdminPanel
          title="Internal notes"
          description="Staff-only records from project_notes where is_internal is true. Not shown to clients."
        >
          {internalNotes.length === 0 ? (
            <p className="text-sm text-muted">No internal notes yet.</p>
          ) : (
            <NotesList projectId={projectId} notes={internalNotes} />
          )}
        </AdminPanel>
        <AdminPanel
          title="Client-visible notes"
          description="Separated from internal notes. Use only when the client should see this content."
        >
          {clientNotes.length === 0 ? (
            <p className="text-sm text-muted">No client-visible notes.</p>
          ) : (
            <NotesList projectId={projectId} notes={clientNotes} />
          )}
        </AdminPanel>
      </div>

      <AdminPanel title="Add note">
        <ActionForm
          action={createProjectNote}
          className="grid gap-3"
          successMessage="Note added."
        >
          <input type="hidden" name="projectId" value={projectId} />
          <textarea name="note" required rows={5} placeholder="Write a note" className={fieldClass} />
          <select name="visibility" defaultValue="internal" className={fieldClass}>
            <option value="internal">Internal only</option>
            <option value="client">Client visible</option>
          </select>
          <SubmitButton>Add note</SubmitButton>
        </ActionForm>
      </AdminPanel>
    </div>
  );
}

function NotesList({
  projectId,
  notes,
}: {
  projectId: string;
  notes: NoteWithAuthor[];
}) {
  return (
    <div className="space-y-4">
      {notes.map((note) => (
        <article key={note.id} className="rounded-2xl border border-card-border p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <StatusPill
              label={note.is_internal ? "Internal" : "Client visible"}
              className={
                note.is_internal
                  ? "border-amber-500/20 bg-amber-500/10 text-amber-700"
                  : "border-emerald-500/20 bg-emerald-500/10 text-emerald-700"
              }
            />
            <span className="text-xs text-muted">
              {clientDisplayName(note.author)} · {formatDateTime(note.created_at)}
            </span>
          </div>
          <ActionForm action={updateProjectNote} className="grid gap-3" successMessage="Note updated.">
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name="noteId" value={note.id} />
            <textarea name="note" defaultValue={note.note} rows={3} required className={fieldClass} />
            <select
              name="visibility"
              defaultValue={note.is_internal ? "internal" : "client"}
              className={fieldClass}
            >
              <option value="internal">Internal only</option>
              <option value="client">Client visible</option>
            </select>
            <SubmitButton variant="secondary">Update note</SubmitButton>
          </ActionForm>
        </article>
      ))}
    </div>
  );
}
