import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AdminLayout } from "@/components/admin/admin-layout";
import { getVisibleAdminNav } from "@/lib/admin";
import { requireAdmin } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin",
  description: "Admin dashboard",
  robots: { index: false, follow: false },
};

export default async function AdminRootLayout({
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
