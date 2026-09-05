"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  addPortfolioImage,
  removePortfolioImage,
  savePortfolioImageOrder,
} from "@/lib/admin-content-actions";
import type { PortfolioProjectImageRow } from "@/types/database";

type ActionResult = { ok: true } | { ok: false; error: string };

const iconButtonClass =
  "rounded-lg border border-card-border px-2 py-1 text-xs font-medium text-muted hover:border-foreground hover:text-foreground disabled:opacity-40";

export function PortfolioImagesManager({
  projectId,
  images,
}: {
  projectId: string;
  images: PortfolioProjectImageRow[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState<PortfolioProjectImageRow[]>(images);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<ActionResult>) {
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        setMessage(result.error);
      } else {
        setMessage(null);
        router.refresh();
      }
    });
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= rows.length) {
      return;
    }
    const next = [...rows];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    setRows(next);
    persistOrder(next);
  }

  function persistOrder(list: PortfolioProjectImageRow[]) {
    run(() =>
      savePortfolioImageOrder(
        projectId,
        list.map((row, index) => ({
          id: row.id,
          altText: row.alt_text ?? "",
          sortOrder: index,
        })),
      ),
    );
  }

  function saveAlt() {
    persistOrder(rows);
  }

  function remove(imageId: string) {
    if (!window.confirm("Remove this image from the gallery?")) {
      return;
    }
    const next = rows.filter((row) => row.id !== imageId);
    setRows(next);
    run(() => removePortfolioImage(imageId));
  }

  return (
    <section className="rounded-3xl border border-card-border bg-card p-6">
      <header className="mb-4">
        <h3 className="font-display text-lg text-foreground">Gallery images</h3>
        <p className="mt-1 text-sm text-muted">
          Images are stored in the photos bucket under photos/portfolio/. Reorder with the
          arrows, edit alt text, then save; or remove an image.
        </p>
      </header>

      {rows.length > 0 ? (
        <ul className="divide-y divide-card-border/60">
          {rows.map((row, index) => (
            <li key={row.id} className="flex items-center gap-3 py-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={row.image_url.trim()}
                alt={row.alt_text ?? ""}
                className="h-14 w-20 shrink-0 rounded-lg border border-card-border object-cover"
              />
              <input
                value={row.alt_text ?? ""}
                onChange={(event) => {
                  const next = [...rows];
                  next[index] = { ...row, alt_text: event.target.value };
                  setRows(next);
                }}
                onBlur={saveAlt}
                placeholder="Alt text"
                className="min-w-0 flex-1 rounded-xl border border-card-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
              />
              <div className="flex shrink-0 items-center gap-1">
                <button type="button" disabled={index === 0} onClick={() => move(index, -1)} className={iconButtonClass}>
                  ▲
                </button>
                <button
                  type="button"
                  disabled={index === rows.length - 1}
                  onClick={() => move(index, 1)}
                  className={iconButtonClass}
                >
                  ▼
                </button>
                <button
                  type="button"
                  onClick={() => remove(row.id)}
                  className="rounded-lg bg-red-600 px-2 py-1 text-xs font-medium text-white"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl bg-background px-3 py-2 text-sm text-muted">
          No gallery images yet — upload the first one below.
        </p>
      )}

      <form
        className="mt-4 grid gap-3 rounded-2xl border border-card-border bg-background p-4 sm:grid-cols-[minmax(0,1fr)_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const fileInput = form.elements.namedItem("file") as HTMLInputElement;
          if (!fileInput.files || fileInput.files.length === 0) {
            setMessage("Choose an image to upload.");
            return;
          }
          const data = new FormData(form);
          run(async () => {
            const result = await addPortfolioImage(data);
            if (result.ok) {
              fileInput.value = "";
            }
            return result;
          });
        }}
      >
        <input type="hidden" name="projectId" value={projectId} />
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            name="alt"
            placeholder="Alt text for new image"
            className="rounded-xl border border-card-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
          />
          <input
            name="file"
            type="file"
            accept="image/*"
            className="text-sm text-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-foreground file:px-3 file:py-2 file:text-xs file:font-medium file:text-background"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-60"
        >
          Upload image
        </button>
      </form>

      {message ? (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">
          {message}
        </p>
      ) : null}
    </section>
  );
}
