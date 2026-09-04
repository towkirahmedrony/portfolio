"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AdminNavIcon } from "@/components/admin/admin-icons";
import { isAdminNavItemActive } from "@/lib/admin";
import { cn } from "@/lib/utils";
import type { AdminNavItem, AdminNavSection } from "@/types/admin";

function NavLink({
  item,
  onNavigate,
}: {
  item: AdminNavItem;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const active = isAdminNavItemActive(item.href, pathname);
  const nested = Boolean(item.children?.length);

  return (
    <div>
      <Link
        href={item.href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-colors",
          active
            ? "bg-accent-soft text-foreground"
            : "text-muted hover:bg-accent-soft/60 hover:text-foreground",
        )}
      >
        <AdminNavIcon name={item.icon} />
        <span>{item.label}</span>
      </Link>
      {nested ? (
        <div className="mt-1 ml-5 space-y-1 border-l border-card-border pl-3">
          {item.children?.map((child) => (
            <NavLink key={child.id} item={child} onNavigate={onNavigate} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function AdminNav({
  sections,
  onNavigate,
}: {
  sections: AdminNavSection[];
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex flex-col gap-6" aria-label="Admin">
      {sections.map((section) => (
        <div key={section.id}>
          {section.label ? (
            <p className="mb-2 px-3 text-[0.7rem] font-medium tracking-[0.18em] text-muted uppercase">
              {section.label}
            </p>
          ) : null}
          <div className="space-y-1">
            {section.items.map((item) => (
              <NavLink key={item.id} item={item} onNavigate={onNavigate} />
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}
