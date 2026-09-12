import Link from "next/link";
import {
  AI_ADMIN_TABS,
  AI_TAB_LABELS,
  buildAdminAiHref,
  type AdminAiTab,
} from "@/lib/admin-ai-constants";

export function AdminAiTabs({ active }: { active: AdminAiTab }) {
  return (
    <nav
      className="mb-6 flex flex-wrap gap-2 rounded-3xl border border-card-border bg-card p-2"
      aria-label="AI management sections"
    >
      {AI_ADMIN_TABS.map((tab) => (
        <Link
          key={tab}
          href={buildAdminAiHref({ tab })}
          aria-current={active === tab ? "page" : undefined}
          className={`rounded-2xl px-4 py-2 text-sm font-medium transition-colors ${
            active === tab
              ? "bg-foreground text-background"
              : "text-muted hover:text-foreground"
          }`}
        >
          {AI_TAB_LABELS[tab]}
        </Link>
      ))}
    </nav>
  );
}
