import { FileDownloader } from "@/components/profile/file-downloader";
import { ActionForm, SubmitButton } from "@/components/admin/projects/action-form";
import { ConfirmSubmitButton } from "@/components/admin/projects/confirm-button";
import { AdminPanel, QueryStateNotice, StatusPill } from "@/components/admin/projects/query-state";
import { deleteProjectFile, uploadProjectFile } from "@/lib/admin-project-actions";
import {
  FILE_CATEGORIES,
  formatBytes,
  formatDateTime,
  formatStatusLabel,
  PROJECT_FILE_BUCKET,
  type QueryResult,
} from "@/lib/admin-projects";
import type { ProjectFileRow } from "@/types/database";

const fieldClass =
  "w-full rounded-xl border border-card-border bg-background px-3 py-2 text-sm text-foreground";

export function ProjectFilesTab({
  projectId,
  result,
}: {
  projectId: string;
  result: QueryResult<ProjectFileRow[]>;
}) {
  if (result.status === "error" || result.status === "unavailable") {
    return <QueryStateNotice result={result} />;
  }

  const files = result.status === "empty" ? [] : result.data;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <AdminPanel
        title="Files"
        description={`Metadata from project_files. Objects are stored in the ${PROJECT_FILE_BUCKET} bucket.`}
      >
        {files.length === 0 ? (
          <QueryStateNotice
            result={{ status: "empty", data: [] }}
            emptyMessage="No files uploaded yet."
          />
        ) : (
          <div className="divide-y divide-card-border">
            {files.map((file) => (
              <div key={file.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{file.original_name}</p>
                  <p className="mt-1 flex flex-wrap gap-2 text-xs text-muted">
                    <StatusPill
                      label={formatStatusLabel(file.category)}
                      className="border-card-border bg-background text-muted"
                    />
                    <span>{file.is_public ? "Client visible" : "Internal"}</span>
                    <span>{formatBytes(file.file_size_bytes)}</span>
                    <span>{formatDateTime(file.created_at)}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <FileDownloader bucketName={file.bucket_name} storagePath={file.storage_path} />
                  <ActionForm action={deleteProjectFile}>
                    <input type="hidden" name="projectId" value={projectId} />
                    <input type="hidden" name="fileId" value={file.id} />
                    <ConfirmSubmitButton
                      message="Soft-delete this file and remove the storage object?"
                      className="rounded-xl border border-red-500/20 px-3 py-1 text-xs font-medium text-red-600"
                    >
                      Delete
                    </ConfirmSubmitButton>
                  </ActionForm>
                </div>
              </div>
            ))}
          </div>
        )}
      </AdminPanel>

      <AdminPanel title="Upload file" description="Uses the existing Supabase Storage client.">
        <ActionForm
          action={uploadProjectFile}
          className="grid gap-3"
          successMessage="File uploaded."
          encType="multipart/form-data"
        >
          <input type="hidden" name="projectId" value={projectId} />
          <input name="file" type="file" required className="text-sm" />
          <select name="category" defaultValue="other" className={fieldClass}>
            {FILE_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {formatStatusLabel(category)}
              </option>
            ))}
          </select>
          <select name="visibility" defaultValue="internal" className={fieldClass}>
            <option value="internal">Internal</option>
            <option value="public">Client visible</option>
          </select>
          <SubmitButton>Upload</SubmitButton>
        </ActionForm>
      </AdminPanel>
    </div>
  );
}
