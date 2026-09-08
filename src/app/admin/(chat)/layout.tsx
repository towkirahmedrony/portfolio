import type { ReactNode } from "react";
import { AdminMessagingProvider } from "@/components/admin/admin-messaging";
import { requireAdmin } from "@/lib/require-admin";

export default async function AdminChatLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireAdmin();

  return (
    <AdminMessagingProvider userId={user.id}>
      <div className="flex h-svh min-h-0 flex-col overflow-hidden bg-background">
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
    </AdminMessagingProvider>
  );
}
