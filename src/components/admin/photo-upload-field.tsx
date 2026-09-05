"use client";

import { useRef, useState, useTransition } from "react";
import { deleteAdminPhoto, uploadAdminPhoto } from "@/lib/photo-actions";
import type { PhotoFolder } from "@/lib/photos";

const accept = "image/*";

type PersistResult = { ok: true } | { ok: false; error: string };

export function PhotoUploadField({
  folder,
  entityId,
  name,
  currentUrl,
  label = "Photo",
  hint,
  required = false,
  persist,
}: {
  folder: PhotoFolder;
  entityId?: string | null;
  name?: string;
  currentUrl?: string | null;
  label?: string;
  hint?: string;
  required?: boolean;
  persist?: (url: string | null) => Promise<PersistResult>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(currentUrl ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function pickFile() {
    inputRef.current?.click();
  }

  function applyUrl(nextUrl: string, previousUrl: string) {
    startTransition(async () => {
      if (persist) {
        const saved = await persist(nextUrl || null);
        if (!saved.ok) {
          setUrl(previousUrl);
          setMessage(saved.error);
          return;
        }
      }
      setMessage(null);
    });
  }

  function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    const previous = url;
    const data = new FormData();
    data.set("folder", folder);
    if (entityId) {
      data.set("entityId", entityId);
    }
    if (previous && !persist) {
      data.set("previousUrl", previous);
    }
    data.set("file", file);

    startTransition(async () => {
      const result = await uploadAdminPhoto(data);
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setUrl(result.url);
      if (persist) {
        const saved = await persist(result.url);
        if (!saved.ok) {
          setUrl(previous);
          setMessage(saved.error);
          const cleanup = new FormData();
          cleanup.set("imageUrl", result.url);
          await deleteAdminPhoto(cleanup);
          return;
        }
      }
      setMessage(null);
    });
  }

  function removePhoto() {
    if (!url) {
      return;
    }
    const previous = url;
    setUrl("");
    startTransition(async () => {
      const data = new FormData();
      data.set("imageUrl", previous);
      const result = await deleteAdminPhoto(data);
      if (!result.ok) {
        setUrl(previous);
        setMessage(result.error);
        return;
      }
      applyUrl("", previous);
    });
  }

  return (
    <div className="grid gap-2 sm:col-span-2">
      <span className="text-sm text-foreground">{label}</span>
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
      {name ? (
        <input type="hidden" name={name} value={url} required={required && !url} />
      ) : null}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        tabIndex={-1}
        onChange={onFileChange}
      />

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-card-border bg-background p-3">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt=""
            className="h-20 w-28 shrink-0 rounded-lg border border-card-border object-cover"
          />
        ) : (
          <div className="flex h-20 w-28 shrink-0 items-center justify-center rounded-lg border border-dashed border-card-border text-xs text-muted">
            No photo
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={pickFile}
            disabled={pending}
            className="rounded-xl bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-60"
          >
            {pending ? "Uploading…" : url ? "Replace photo" : "Upload photo"}
          </button>
          {url ? (
            <button
              type="button"
              onClick={removePhoto}
              disabled={pending}
              className="rounded-xl border border-card-border px-3 py-2 text-sm font-medium text-muted hover:text-foreground disabled:opacity-60"
            >
              Remove
            </button>
          ) : null}
        </div>
      </div>
      {message ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {message}
        </p>
      ) : null}
    </div>
  );
}
