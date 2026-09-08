"use client";

import { useId, useRef, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  formatFileSize,
  PROJECT_REQUEST_FILE_ACCEPT,
  PROJECT_REQUEST_MAX_FILE_BYTES,
  PROJECT_REQUEST_MAX_FILES,
  type ProjectRequestFileSummary,
} from "@/lib/project-request-files";

export type PendingProjectRequestFile = {
  id: string;
  file: File;
  fieldKey: string;
};

type Props = {
  existingFiles: ProjectRequestFileSummary[];
  pendingFiles: PendingProjectRequestFile[];
  currentUserId?: string | null;
  disabled?: boolean;
  uploading?: boolean;
  uploadingLabel?: string | null;
  error?: string | null;
  label?: string;
  hint?: string;
  required?: boolean;
  maxFiles?: number;
  multiple?: boolean;
  compact?: boolean;
  onAddFiles: (files: File[]) => void;
  onRemovePending: (id: string) => void;
  onRemoveExisting: (file: ProjectRequestFileSummary) => void;
};

function canRemoveExisting(
  file: ProjectRequestFileSummary,
  currentUserId?: string | null,
): boolean {
  if (!file.uploaded_by) {
    return true;
  }
  if (!currentUserId) {
    return false;
  }
  return file.uploaded_by === currentUserId;
}

export function ProjectRequestFileUploadField({
  existingFiles,
  pendingFiles,
  currentUserId,
  disabled = false,
  uploading = false,
  uploadingLabel,
  error,
  label = "Attachments",
  hint,
  required = false,
  maxFiles = PROJECT_REQUEST_MAX_FILES,
  multiple = true,
  compact = false,
  onAddFiles,
  onRemovePending,
  onRemoveExisting,
}: Props) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const totalSelected = existingFiles.length + pendingFiles.length;
  const remaining = Math.max(maxFiles - totalSelected, 0);
  const helper =
    hint ??
    `Optional. JPG, PNG, WEBP, SVG, PDF, or ZIP. Up to ${Math.round(PROJECT_REQUEST_MAX_FILE_BYTES / 1024 / 1024)} MB each, ${maxFiles} ${maxFiles === 1 ? "file" : "files"} total.`;

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length > 0) {
      onAddFiles(files);
    }
  }

  return (
    <div className={compact ? undefined : "sm:col-span-2"}>
      <div className="grid gap-3 rounded-2xl border border-card-border bg-background p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <label htmlFor={inputId} className="text-sm font-medium">
              {label}
              {required ? (
                <span className="text-accent" aria-hidden="true">
                  {" "}
                  *
                </span>
              ) : null}
            </label>
            <p className="mt-1 text-xs leading-5 text-muted">{helper}</p>
          </div>
          <Button
            variant="secondary"
            size="md"
            disabled={disabled || uploading || remaining === 0}
            onClick={() => inputRef.current?.click()}
          >
            {maxFiles === 1 ? "Choose file" : "Add files"}
          </Button>
        </div>

        <input
          ref={inputRef}
          id={inputId}
          type="file"
          multiple={multiple && maxFiles > 1}
          accept={PROJECT_REQUEST_FILE_ACCEPT}
          className="sr-only"
          disabled={disabled || uploading || remaining === 0}
          onChange={handleChange}
        />

        {existingFiles.length === 0 && pendingFiles.length === 0 ? (
          <p className="text-sm text-muted">No files selected yet.</p>
        ) : (
          <ul className="grid gap-2">
            {existingFiles.map((file) => (
              <li
                key={file.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-card-border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{file.original_name}</p>
                  <p className="text-xs text-muted">
                    {formatFileSize(file.file_size_bytes)} · already uploaded
                  </p>
                </div>
                {canRemoveExisting(file, currentUserId) ? (
                  <Button
                    variant="ghost"
                    size="md"
                    className="h-8 px-3 text-xs"
                    disabled={disabled || uploading}
                    onClick={() => onRemoveExisting(file)}
                  >
                    Remove
                  </Button>
                ) : null}
              </li>
            ))}
            {pendingFiles.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-card-border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.file.name}</p>
                  <p className="text-xs text-muted">{formatFileSize(item.file.size)}</p>
                </div>
                <Button
                  variant="ghost"
                  size="md"
                  className="h-8 px-3 text-xs"
                  disabled={disabled || uploading}
                  onClick={() => onRemovePending(item.id)}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}

        {uploading && uploadingLabel ? (
          <p className="text-sm text-muted" role="status">
            {uploadingLabel}
          </p>
        ) : null}
        {error ? (
          <p className="text-xs leading-5 text-accent" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
