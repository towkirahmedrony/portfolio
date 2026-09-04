"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveNotificationPreferences } from "@/lib/admin-settings-actions";
import {
  NOTIFICATION_TOGGLES,
  type EffectiveNotificationPreferences,
  type NotificationToggleKey,
} from "@/lib/notification-preference-definitions";

type ActionResult = { ok: true } | { ok: false; error: string };

export function NotificationPreferencesCard({
  preferences,
  exists,
}: {
  preferences: EffectiveNotificationPreferences;
  exists: boolean;
}) {
  const router = useRouter();
  const [values, setValues] =
    useState<EffectiveNotificationPreferences>(preferences);
  const [status, setStatus] = useState<
    "saved" | "saving" | "unsaved" | "error" | null
  >(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const dirty = NOTIFICATION_TOGGLES.some(
    (toggle) => values[toggle.key] !== preferences[toggle.key],
  );

  function toggle(key: NotificationToggleKey, next: boolean) {
    setValues((current) => ({ ...current, [key]: next }));
    setStatus("unsaved");
    setErrorMessage(null);
  }

  function save() {
    if (!dirty || pending) {
      return;
    }
    setStatus("saving");
    setErrorMessage(null);
    startTransition(async () => {
      const data = new FormData();
      for (const toggle of NOTIFICATION_TOGGLES) {
        data.set(toggle.key, values[toggle.key] ? "on" : "off");
      }
      const result: ActionResult = await saveNotificationPreferences(data);
      if (!result.ok) {
        setStatus("error");
        setErrorMessage(result.error);
        return;
      }
      setStatus("saved");
      window.setTimeout(() => setStatus(null), 3000);
      router.refresh();
    });
  }

  const statusLabel =
    status === "saving"
      ? "Saving…"
      : status === "saved"
        ? "Saved"
        : status === "error"
          ? "Could not save"
          : dirty
            ? "Unsaved changes"
            : "All changes saved";

  return (
    <section className="mx-auto w-full max-w-3xl rounded-3xl border border-card-border bg-card p-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-lg text-foreground">Notification preferences</h3>
          <p className="mt-1 text-sm text-muted">
            {exists
              ? "Choose which activity sends you email."
              : "Using default preferences — saving will store them for your admin account."}
          </p>
        </div>
        <span
          className={`rounded-full border px-3 py-1 text-xs font-medium ${
            status === "saved"
              ? "border-transparent bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              : dirty || status === "saving"
                ? "border-transparent bg-amber-500/10 text-amber-700 dark:text-amber-400"
                : status === "error"
                  ? "border-transparent bg-red-500/10 text-red-700 dark:text-red-400"
                  : "border-card-border text-muted"
          }`}
        >
          {statusLabel}
        </span>
      </header>

      <ul className="mt-5 divide-y divide-card-border/60">
        {NOTIFICATION_TOGGLES.map((pref) => (
          <li key={pref.key} className="flex items-center justify-between gap-4 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">{pref.label}</p>
              <p className="mt-0.5 text-xs text-muted">{pref.description}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={values[pref.key]}
              aria-label={pref.label}
              onClick={() => toggle(pref.key, !values[pref.key])}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                values[pref.key] ? "bg-emerald-500" : "bg-foreground/15"
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                  values[pref.key] ? "left-[1.375rem]" : "left-0.5"
                }`}
              />
            </button>
          </li>
        ))}
      </ul>

      <footer className="mt-4 flex flex-wrap items-center gap-3 border-t border-card-border/60 pt-4">
        <button
          type="button"
          disabled={!dirty || pending}
          onClick={save}
          className="rounded-xl bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
        >
          Save preferences
        </button>
        <button
          type="button"
          disabled={!dirty || pending}
          onClick={() => {
            setValues(preferences);
            setStatus(null);
            setErrorMessage(null);
          }}
          className="rounded-xl border border-card-border px-4 py-2 text-sm font-medium text-foreground disabled:opacity-50"
        >
          Discard changes
        </button>
        {status === "error" ? (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {errorMessage}
          </p>
        ) : null}
      </footer>
    </section>
  );
}
