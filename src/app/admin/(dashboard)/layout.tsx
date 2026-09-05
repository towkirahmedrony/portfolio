import type { ReactNode } from "react";
import { AdminLayout } from "@/components/admin/admin-layout";
import { getVisibleAdminNav } from "@/lib/admin";
import { requireAdmin } from "@/lib/require-admin";

export default async function AdminDashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireAdmin();
  const sections = getVisibleAdminNav(user.role);

  return (
    <AdminLayout user={user} sections={sections}>
      {children}
    </AdminLayout>
  );
}
