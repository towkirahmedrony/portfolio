"use client";

import { CloseIcon, MenuIcon } from "@/components/admin/admin-icons";
import { ThemeToggle } from "@/components/theme-toggle";
import { ButtonLink } from "@/components/ui/button";
import type { AdminSessionUser } from "@/types/admin";

export function AdminHeader({
  title,
  user,
  menuOpen,
  onMenuToggle,
}: {
  title: string;
  user: AdminSessionUser;
  menuOpen: boolean;
  onMenuToggle: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-card-border/80 bg-nav backdrop-blur-md">
      <div className="flex h-16 items-center justify-between gap-4 px-4 sm:h-[4.25rem] sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-card-border bg-card lg:hidden"
            aria-expanded={menuOpen}
            aria-controls="admin-mobile-sidebar"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={onMenuToggle}
          >
            {menuOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
          <div className="min-w-0">
            <p className="text-xs font-medium tracking-[0.18em] text-muted uppercase">
              Admin
            </p>
            <h1 className="font-display truncate text-lg tracking-tight sm:text-xl">
              {title}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <p className="hidden truncate text-sm text-muted sm:block">
            {user.displayName}
          </p>
          <ThemeToggle />
          <ButtonLink href="/" variant="secondary" className="hidden sm:inline-flex">
            View site
          </ButtonLink>
        </div>
      </div>
    </header>
  );
}
