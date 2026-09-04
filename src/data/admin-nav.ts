import type { AdminNavSection } from "@/types/admin";

export const adminNavSections: AdminNavSection[] = [
  {
    id: "overview",
    items: [
      { id: "dashboard", label: "Dashboard", href: "/admin", icon: "dashboard", roles: ["admin"] },
      { id: "profile", label: "Profile", href: "/admin/profile", icon: "profile", roles: ["admin"] },
      { id: "settings", label: "Settings", href: "/admin/settings", icon: "settings", roles: ["admin"] },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    items: [
      { id: "project-requests", label: "Project Requests", href: "/admin/project-requests", icon: "orders", roles: ["admin"] },
      { id: "projects", label: "Projects", href: "/admin/projects", icon: "projects", roles: ["admin"] },
      { id: "clients", label: "Clients", href: "/admin/clients", icon: "clients", roles: ["admin"] },
      { id: "quotes", label: "Quotes", href: "/admin/quotes", icon: "quotes", roles: ["admin"] },
      { id: "invoices", label: "Invoices", href: "/admin/invoices", icon: "invoices", roles: ["admin"] },
      { id: "payments", label: "Payments", href: "/admin/payments", icon: "payments", roles: ["admin"] },
    ],
  },
  {
    id: "growth",
    label: "Growth",
    items: [
      { id: "referrals", label: "Referrals", href: "/admin/referrals", icon: "referrals", roles: ["admin"] },
      { id: "messages", label: "Messages", href: "/admin/messages", icon: "messages", roles: ["admin"] },
      { id: "notifications", label: "Notifications", href: "/admin/notifications", icon: "notifications", roles: ["admin"], enabled: false },
    ],
  },
  {
    id: "content",
    label: "Content",
    items: [
      { id: "portfolio", label: "Portfolio", href: "/admin/portfolio", icon: "portfolio", roles: ["admin"] },
      { id: "services", label: "Services", href: "/admin/services", icon: "services", roles: ["admin"] },
      { id: "reviews", label: "Reviews", href: "/admin/reviews", icon: "reviews", roles: ["admin"] },
      { id: "files", label: "Files", href: "/admin/files", icon: "files", roles: ["admin"], enabled: false },
    ],
  },
  {
    id: "system",
    label: "System",
    items: [
      { id: "audit-logs", label: "Audit Logs", href: "/admin/audit-logs", icon: "audit", roles: ["admin"] },
      { id: "payment-events", label: "Payment Events", href: "/admin/payment-events", icon: "payments", roles: ["admin"] },
    ],
  },
];
