import Link from "next/link";
import { AdminNav } from "@/components/admin/admin-nav";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { site } from "@/data/site";
import type { AdminNavSection } from "@/types/admin";

export function AdminSidebar({
  sections,
  onNavigate,
}: {
  sections: AdminNavSection[];
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-card-border px-5 py-5">
        <Link
          href="/admin"
          onClick={onNavigate}
          className="font-display text-[0.95rem] tracking-tight"
        >
          {site.name}
        </Link>
        <p className="mt-1 text-xs tracking-[0.16em] text-muted uppercase">
          Admin
        </p>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-5">
        <AdminNav sections={sections} onNavigate={onNavigate} />
      </div>
      <div className="border-t border-card-border px-3 py-4">
        <SignOutButton />
      </div>
    </div>
  );
}
