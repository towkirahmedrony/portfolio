import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

const controlClasses =
  "w-full rounded-xl border border-card-border bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

type FieldProps = {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
};

export function Field({
  id,
  label,
  required,
  hint,
  error,
  children,
}: FieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        {required ? (
          <span className="text-accent" aria-hidden="true">
            {" "}
            *
          </span>
        ) : null}
        {required ? <span className="sr-only"> (required)</span> : null}
      </label>
      {children}
      {hint && !error ? (
        <p id={hintId} className="text-xs leading-5 text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-xs leading-5 text-accent">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type TextInputProps = ComponentProps<"input"> & {
  error?: string;
};

export function TextInput({ className, error, id, ...props }: TextInputProps) {
  return (
    <input
      id={id}
      className={cn(controlClasses, error && "border-accent", className)}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `${id}-error` : undefined}
      {...props}
    />
  );
}

type TextAreaProps = ComponentProps<"textarea"> & {
  error?: string;
};

export function TextArea({ className, error, id, ...props }: TextAreaProps) {
  return (
    <textarea
      id={id}
      className={cn(
        controlClasses,
        "min-h-36 resize-y leading-6",
        error && "border-accent",
        className,
      )}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `${id}-error` : undefined}
      {...props}
    />
  );
}

type SelectInputProps = ComponentProps<"select"> & {
  error?: string;
};

export function SelectInput({
  className,
  error,
  id,
  children,
  ...props
}: SelectInputProps) {
  return (
    <select
      id={id}
      className={cn(controlClasses, error && "border-accent", className)}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `${id}-error` : undefined}
      {...props}
    >
      {children}
    </select>
  );
}

type ChoiceOption<T extends string> = {
  value: T;
  label: string;
  description?: string;
};

type ChoiceGroupProps<T extends string> = {
  legend: string;
  name: string;
  options: Array<ChoiceOption<T>>;
  value: T | "";
  onChange: (value: T) => void;
  required?: boolean;
  error?: string;
  columns?: 1 | 2 | 3;
};

export function ChoiceGroup<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
  required,
  error,
  columns = 2,
}: ChoiceGroupProps<T>) {
  const errorId = error ? `${name}-error` : undefined;

  return (
    <fieldset aria-describedby={errorId} aria-invalid={error ? true : undefined}>
      <legend className="mb-3 text-sm font-medium">
        {legend}
        {required ? (
          <span className="text-accent" aria-hidden="true">
            {" "}
            *
          </span>
        ) : null}
        {required ? <span className="sr-only"> (required)</span> : null}
      </legend>
      <div
        className={cn(
          "grid gap-3",
          columns === 1 && "grid-cols-1",
          columns === 2 && "sm:grid-cols-2",
          columns === 3 && "sm:grid-cols-2 lg:grid-cols-3",
        )}
      >
        {options.map((option) => {
          const selected = value === option.value;
          const optionId = `${name}-${option.value}`;

          return (
            <label
              key={option.value}
              htmlFor={optionId}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm transition-colors",
                selected
                  ? "border-accent bg-accent-soft"
                  : "border-card-border bg-background hover:border-foreground/20",
              )}
            >
              <input
                id={optionId}
                type="radio"
                name={name}
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
                className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
              />
              <span>
                <span className="block font-medium">{option.label}</span>
                {option.description ? (
                  <span className="mt-1 block text-xs leading-5 text-muted">
                    {option.description}
                  </span>
                ) : null}
              </span>
            </label>
          );
        })}
      </div>
      {error ? (
        <p id={errorId} role="alert" className="mt-3 text-xs text-accent">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

type CheckboxGroupProps<T extends string> = {
  legend: string;
  name: string;
  options: Array<ChoiceOption<T>>;
  values: T[];
  onChange: (values: T[]) => void;
  error?: string;
};

export function CheckboxGroup<T extends string>({
  legend,
  name,
  options,
  values,
  onChange,
  error,
}: CheckboxGroupProps<T>) {
  const errorId = error ? `${name}-error` : undefined;

  function toggle(option: T) {
    if (values.includes(option)) {
      onChange(values.filter((value) => value !== option));
      return;
    }

    onChange([...values, option]);
  }

  return (
    <fieldset aria-describedby={errorId}>
      <legend className="mb-3 text-sm font-medium">{legend}</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {options.map((option) => {
          const selected = values.includes(option.value);
          const optionId = `${name}-${option.value}`;

          return (
            <label
              key={option.value}
              htmlFor={optionId}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors",
                selected
                  ? "border-accent bg-accent-soft"
                  : "border-card-border bg-background hover:border-foreground/20",
              )}
            >
              <input
                id={optionId}
                type="checkbox"
                name={name}
                value={option.value}
                checked={selected}
                onChange={() => toggle(option.value)}
                className="h-4 w-4 accent-[var(--accent)]"
              />
              <span className="font-medium">{option.label}</span>
            </label>
          );
        })}
      </div>
      {error ? (
        <p id={errorId} role="alert" className="mt-3 text-xs text-accent">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
