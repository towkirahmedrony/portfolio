"use client";

export function ConfirmSubmitButton({
  message,
  children,
  className,
}: {
  message: string;
  children: string;
  className?: string;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(event) => {
        if (!window.confirm(message)) {
          event.preventDefault();
        }
      }}
    >
      {children}
    </button>
  );
}
