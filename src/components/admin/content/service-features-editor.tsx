"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveServiceFeatures } from "@/lib/admin-content-actions";
import type { ServiceFeatureRow } from "@/types/database";

type ActionResult = { ok: true } | { ok: false; error: string };

const iconButtonClass =
  "rounded-lg border border-card-border px-2 py-1 text-xs font-medium text-muted hover:border-foreground hover:text-foreground disabled:opacity-40";

type FeatureDraft = { key: string; id: string | null; feature: string };

let keyCounter = 0;

export function ServiceFeaturesEditor({
  serviceId,
  features,
}: {
  serviceId: string;
  features: ServiceFeatureRow[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState<FeatureDraft[]>(
    features.map((feature) => ({
      key: `existing-${feature.id}`,
      id: feature.id,
      feature: feature.feature,
    })),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function updateValue(key: string, value: string) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, feature: value } : row)),
    );
  }

  function move(key: string, direction: -1 | 1) {
    setRows((current) => {
      const index = current.findIndex((row) => row.key === key);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) {
        return current;
      }
      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  }

  function add() {
    keyCounter += 1;
    setRows((current) => [...current, { key: `new-${keyCounter}`, id: null, feature: "" }]);
  }

  function remove(key: string) {
    setRows((current) => current.filter((row) => row.key !== key));
  }

  function save() {
    startTransition(async () => {
      const result: ActionResult = await saveServiceFeatures(
        serviceId,
        rows.map((row) => ({ id: row.id, feature: row.feature })),
      );
      if (!result.ok) {
        setMessage(result.error);
      } else {
        setMessage(null);
        router.refresh();
      }
    });
  }

  return (
    <section className="rounded-3xl border border-card-border bg-card p-6">
      <header className="mb-4">
        <h3 className="font-display text-lg text-foreground">Feature bullets</h3>
        <p className="mt-1 text-sm text-muted">
          Shown as bullet points on the service. Order them, then save the list.
        </p>
      </header>

      {rows.length > 0 ? (
        <ul className="divide-y divide-card-border/60">
          {rows.map((row, index) => (
            <li key={row.key} className="flex items-center gap-2 py-2">
              <input
                value={row.feature}
                onChange={(event) => updateValue(row.key, event.target.value)}
                placeholder="Feature description"
                className="min-w-0 flex-1 rounded-xl border border-card-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
              />
              <div className="flex shrink-0 items-center gap-1">
                <button type="button" disabled={index === 0} onClick={() => move(row.key, -1)} className={iconButtonClass}>
                  ▲
                </button>
                <button
                  type="button"
                  disabled={index === rows.length - 1}
                  onClick={() => move(row.key, 1)}
                  className={iconButtonClass}
                >
                  ▼
                </button>
                <button
                  type="button"
                  onClick={() => remove(row.key)}
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
          No feature bullets yet — add the first one below.
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={add}
          className="rounded-xl border border-card-border px-3 py-2 text-sm font-medium text-foreground hover:border-foreground"
        >
          Add bullet
        </button>
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded-xl bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-60"
        >
          Save bullets
        </button>
      </div>

      {message ? (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">
          {message}
        </p>
      ) : null}
    </section>
  );
}
