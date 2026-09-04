"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AdminHeader } from "@/components/admin/admin-header";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { findAdminNavItem } from "@/lib/admin";
import type { AdminNavSection, AdminSessionUser } from "@/types/admin";

export function AdminLayout({
  user,
  sections,
  children,
}: {
  user: AdminSessionUser;
  sections: AdminNavSection[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPath, setMenuPath] = useState(pathname);
  const activeItem = findAdminNavItem(pathname, sections);
  const title = activeItem?.label ?? "Dashboard";

  if (menuPath !== pathname) {
    setMenuPath(pathname);
    setMenuOpen(false);
  }

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  return (
    <div className="min-h-svh bg-background">
      <div className="lg:grid lg:grid-cols-[16.5rem_minmax(0,1fr)]">
        <aside className="sticky top-0 hidden h-svh border-r border-card-border bg-card lg:block">
          <AdminSidebar sections={sections} />
        </aside>

        <div className="flex min-h-svh flex-col">
          <AdminHeader
            title={title}
            user={user}
            menuOpen={menuOpen}
            onMenuToggle={() => setMenuOpen((open) => !open)}
          />
          <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
        </div>
      </div>

      {menuOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-foreground/30"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          />
          <aside
            id="admin-mobile-sidebar"
            className="absolute inset-y-0 left-0 z-50 w-[min(20rem,88vw)] border-r border-card-border bg-card shadow-[0_12px_40px_rgba(20,20,20,0.12)]"
          >
            <AdminSidebar
              sections={sections}
              onNavigate={() => setMenuOpen(false)}
            />
          </aside>
        </div>
      ) : null}
    </div>
  );
}
