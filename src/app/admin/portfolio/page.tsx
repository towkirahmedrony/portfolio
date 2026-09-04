import { AdminPage, AdminPlaceholderCard } from "@/components/admin/admin-page";

export default function AdminPortfolioPage() {
  return (
    <AdminPage
      title="Portfolio Management"
      description="Manage your portfolio projects and showcase your best work."
    >
      <AdminPlaceholderCard
        title="Portfolio Database Connection"
        description="This module will fetch from portfolio_projects and portfolio_project_images tables."
      />
    </AdminPage>
  );
}
