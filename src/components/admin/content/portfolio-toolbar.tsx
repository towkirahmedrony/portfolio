"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  buildPortfolioHref,
  type ContentListFilters,
} from "@/lib/admin-content-constants";

export function PortfolioToolbar({ filters }: { filters: ContentListFilters }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function update(next: Partial<ContentListFilters>) {
    const merged: ContentListFilters = { ...filters, ...next };
    for (const key of ["q", "published", "featured"] as const) {
      if (!merged[key]) delete merged[key];
    }
    startTransition(() => {
      router.push(buildPortfolioHref(merged));
    });
  }

  const published = filters.published ?? "all";
  const featured = filters.featured ?? "all";

  return (
    <div className="mb-6 space-y-3">
      <form
        className="grid gap-3 rounded-3xl border border-card-border bg-card p-4 sm:grid-cols-[minmax(0,1fr)_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          update({ q: String(data.get("q") ?? "").trim() });
        }}
      >
        <input
          name="q"
          defaultValue={filters.q ?? ""}
          placeholder="Search title, slug, category, description"
          className="rounded-xl border border-card-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
        />
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-xl bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-60"
          >
            Search
          </button>
          <Link
            href="/admin/portfolio/new"
            className="rounded-xl bg-foreground px-3 py-2 text-sm font-medium text-background"
          >
            Add project
          </Link>
        </div>
      </form>

      <div className="flex flex-wrap gap-2 text-xs font-medium">
        <span className="self-center text-muted">Published:</span>
        {[
          { value: "all", label: "All" },
          { value: "true", label: "Published" },
          { value: "false", label: "Draft" },
        ].map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => update({ published: option.value })}
            className={`rounded-full border px-3 py-1 transition-colors ${
              published === option.value
                ? "border-foreground bg-foreground text-background"
                : "border-card-border text-muted hover:text-foreground"
            }`}
          >
            {option.label}
          </button>
        ))}
        <span className="ml-2 self-center text-muted">Featured:</span>
        {[
          { value: "all", label: "All" },
          { value: "true", label: "Featured" },
          { value: "false", label: "Not featured" },
        ].map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => update({ featured: option.value })}
            className={`rounded-full border px-3 py-1 transition-colors ${
              featured === option.value
                ? "border-foreground bg-foreground text-background"
                : "border-card-border text-muted hover:text-foreground"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
