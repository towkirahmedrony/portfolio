import { AdminPage, AdminPlaceholderCard } from "@/components/admin/admin-page";

export default function AdminSettingsPage() {
  return (
    <AdminPage
      title="Settings"
      description="Workspace and platform settings will be added here. The layout already supports this route."
    >
      <AdminPlaceholderCard
        title="Settings is coming later"
        description="Add configuration screens to this page. Navigation, layout, and access control are already handled."
      />
    </AdminPage>
  );
}
