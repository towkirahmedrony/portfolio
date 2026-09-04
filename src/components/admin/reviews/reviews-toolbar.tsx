"use client";

import { useRouter, usePathname } from "next/navigation";
import { useTransition } from "react";
import { REVIEW_STATUS_LABELS, REVIEW_STATUSES } from "@/lib/admin-review-constants";

const TABS = [
  { value: "all", label: "All" },
  ...REVIEW_STATUSES.map((status) => ({ value: status, label: REVIEW_STATUS_LABELS[status] })),
];

export function ReviewsToolbar({ current }: { current: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  function select(value: string) {
    startTransition(() => {
      router.push(value === "all" ? pathname : `${pathname}?status=${value}`);
    });
  }

  return (
    <div
      className="mb-6 flex flex-wrap items-center gap-2 rounded-3xl border border-card-border bg-card p-2"
      role="tablist"
      aria-label="Filter reviews by status"
    >
      {TABS.map((tab) => (
        <button
          key={tab.value}
          role="tab"
          aria-selected={current === tab.value}
          type="button"
          onClick={() => select(tab.value)}
          disabled={pending}
          className={`rounded-2xl px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60 ${
            current === tab.value
              ? "bg-foreground text-background"
              : "text-muted hover:text-foreground"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
