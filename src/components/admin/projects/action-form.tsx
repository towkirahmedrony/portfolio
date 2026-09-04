"use client";

import { useActionState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

type ActionResult = { ok: true; quoteId?: string } | { ok: false; error: string };

export function ActionForm({
  action,
  children,
  className,
  successMessage,
  encType,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  children: ReactNode;
  className?: string;
  successMessage?: string;
  encType?: string;
}) {
  const [state, formAction] = useActionState(
    async (_prev: ActionResult | null, formData: FormData) => action(formData),
    null,
  );

  return (
    <form action={formAction} className={className} encType={encType}>
      {children}
      {state?.ok && successMessage ? (
        <p className="text-xs text-emerald-600">{successMessage}</p>
      ) : null}
      {state && !state.ok ? (
        <p className="text-xs text-red-600" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

export function SubmitButton({
  children,
  pendingLabel = "Saving…",
  className,
  variant = "primary",
}: {
  children: string;
  pendingLabel?: string;
  className?: string;
  variant?: "primary" | "secondary" | "danger";
}) {
  const { pending } = useFormStatus();
  const styles = {
    primary: "bg-foreground text-background",
    secondary: "border border-card-border bg-background text-foreground",
    danger: "bg-red-600 text-white",
  };

  return (
    <button
      type="submit"
      disabled={pending}
      className={`rounded-xl px-3 py-2 text-sm font-medium disabled:opacity-60 ${styles[variant]} ${className ?? ""}`}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
