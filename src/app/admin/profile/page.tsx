import { AdminPage, AdminPlaceholderCard } from "@/components/admin/admin-page";

export default function AdminProfilePage() {
  return (
    <AdminPage
      title="Profile"
      description="Admin account details will live here. This page is a placeholder so the dashboard navigation is already in place."
    >
      <AdminPlaceholderCard
        title="Admin profile is coming later"
        description="Use this route for admin identity, contact details, and account preferences without rebuilding the sidebar."
      />
    </AdminPage>
  );
}
