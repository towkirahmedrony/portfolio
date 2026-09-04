import { AdminPage, AdminPlaceholderCard } from "@/components/admin/admin-page";

export default function AdminDashboardPage() {
  return (
    <AdminPage
      title="Dashboard"
      description="A starting point for managing project requests, clients, and site content. Feature modules will be added here later."
    >
      <AdminPlaceholderCard
        title="Overview is not connected yet"
        description="This admin shell is ready. Add dashboard widgets and reports here without changing the layout."
      />
    </AdminPage>
  );
}
