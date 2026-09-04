import type { ProfileRole } from "@/types/database";

export type AdminNavIcon =
  | "dashboard"
  | "profile"
  | "settings"
  | "orders"
  | "projects"
  | "clients"
  | "quotes"
  | "invoices"
  | "payments"
  | "referrals"
  | "messages"
  | "notifications"
  | "portfolio"
  | "services"
  | "reviews"
  | "files"
  | "audit";

export type AdminNavItem = {
  id: string;
  label: string;
  href: string;
  icon: AdminNavIcon;
  roles?: ProfileRole[];
  permissions?: string[];
  enabled?: boolean;
  children?: AdminNavItem[];
};

export type AdminNavSection = {
  id: string;
  label?: string;
  items: AdminNavItem[];
};

export type AdminSessionUser = {
  id: string;
  email: string;
  displayName: string;
  role: ProfileRole;
};
