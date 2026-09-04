import { adminNavSections } from "@/data/admin-nav";
import type { AdminNavItem, AdminNavSection } from "@/types/admin";
import type { ProfileRole } from "@/types/database";

export function isAdminRole(role: ProfileRole | null | undefined): boolean {
  return role === "admin";
}

export function isAdminNavItemEnabled(item: AdminNavItem): boolean {
  return item.enabled !== false;
}

export function canAccessAdminNavItem(
  item: AdminNavItem,
  role: ProfileRole,
): boolean {
  if (!isAdminNavItemEnabled(item)) {
    return false;
  }

  if (item.roles && item.roles.length > 0 && !item.roles.includes(role)) {
    return false;
  }

  return true;
}

function filterNavItems(
  items: AdminNavItem[],
  role: ProfileRole,
): AdminNavItem[] {
  const next: AdminNavItem[] = [];

  for (const item of items) {
    const children = item.children
      ? filterNavItems(item.children, role)
      : undefined;
    const visible = canAccessAdminNavItem(item, role);

    if (!visible && (!children || children.length === 0)) {
      continue;
    }

    const filtered: AdminNavItem = {
      ...item,
    };

    if (children && children.length > 0) {
      filtered.children = children;
    } else {
      delete filtered.children;
    }

    next.push(filtered);
  }

  return next;
}

export function getVisibleAdminNav(role: ProfileRole): AdminNavSection[] {
  return adminNavSections
    .map((section) => ({
      ...section,
      items: filterNavItems(section.items, role),
    }))
    .filter((section) => section.items.length > 0);
}

export function isAdminNavItemActive(href: string, pathname: string): boolean {
  if (href === "/admin") {
    return pathname === "/admin";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function findAdminNavItem(
  pathname: string,
  sections: AdminNavSection[] = adminNavSections,
): AdminNavItem | null {
  for (const section of sections) {
    const match = findItem(section.items, pathname);
    if (match) {
      return match;
    }
  }

  return null;
}

function findItem(items: AdminNavItem[], pathname: string): AdminNavItem | null {
  for (const item of items) {
    if (item.children) {
      const child = findItem(item.children, pathname);
      if (child) {
        return child;
      }
    }

    if (isAdminNavItemActive(item.href, pathname)) {
      return item;
    }
  }

  return null;
}
