import { ActionForm } from "@/components/admin/projects/action-form";
import { ConfirmSubmitButton } from "@/components/admin/projects/confirm-button";

type ActionResult = { ok: true } | { ok: false; error: string };

const pillClass =
  "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-60";

/** Small form that flips a boolean flag (published/featured) for a row. */
export function FlagToggle({
  action,
  hidden,
  active,
  activeLabel,
  inactiveLabel,
  activeClass,
  inactiveClass,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  hidden: Record<string, string>;
  active: boolean;
  activeLabel: string;
  inactiveLabel: string;
  activeClass: string;
  inactiveClass: string;
}) {
  return (
    <ActionForm action={action} className="inline-flex">
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <input type="hidden" name="value" value={active ? "false" : "true"} />
      <button
        type="submit"
        title={active ? `Currently ${activeLabel}. Click to turn off.` : `Currently ${inactiveLabel}. Click to turn on.`}
        className={`${pillClass} ${active ? activeClass : inactiveClass}`}
      >
        {active ? activeLabel : inactiveLabel}
      </button>
    </ActionForm>
  );
}

/** Row reorder (▲/▼) that swaps sort_order with the neighbour row. */
export function ReorderForm({
  action,
  hidden,
  direction,
  disabled,
  label,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  hidden: Record<string, string>;
  direction: "up" | "down";
  disabled: boolean;
  label: string;
}) {
  return (
    <ActionForm action={action} className="inline-flex">
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <input type="hidden" name="direction" value={direction} />
      <button
        type="submit"
        disabled={disabled}
        aria-label={label}
        className="rounded-lg border border-card-border px-2 py-1 text-xs font-medium text-muted hover:border-foreground hover:text-foreground disabled:opacity-40 disabled:hover:border-card-border disabled:hover:text-muted"
      >
        {direction === "up" ? "▲" : "▼"}
      </button>
    </ActionForm>
  );
}

/** Destructive delete action with a confirmation prompt and inline error/success. */
export function DeleteActionForm({
  action,
  hidden,
  confirmMessage,
  label,
  successMessage,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  hidden: Record<string, string>;
  confirmMessage: string;
  label: string;
  successMessage: string;
}) {
  return (
    <ActionForm action={action} successMessage={successMessage} className="inline-flex items-start">
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <ConfirmSubmitButton
        message={confirmMessage}
        className="rounded-lg bg-red-600 px-2.5 py-1 text-xs font-medium text-white"
      >
        {label}
      </ConfirmSubmitButton>
    </ActionForm>
  );
}
