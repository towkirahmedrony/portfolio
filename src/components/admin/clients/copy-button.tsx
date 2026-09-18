"use client";

import { useState } from "react";

/**
 * Copy-to-clipboard affordance for admin detail fields (email, phone).
 *
 * Mirrors the existing clipboard pattern already used in the admin/client area
 * (`src/components/profile/referral-section.tsx`): a plain button that writes
 * to `navigator.clipboard` and reports success inline. Kept as the only client
 * island in the client details card so the card itself stays a server
 * component and no client details are ever fetched from the browser.
 */
export function CopyButton({
  value,
  label,
  className,
}: {
  value: string;
  label: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={`Copy ${label}`}
      aria-label={`Copy ${label}`}
      className={
        className ??
        "shrink-0 rounded-lg border border-card-border px-2 py-0.5 text-[11px] font-medium text-muted transition-colors hover:border-foreground/30 hover:text-foreground"
      }
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
