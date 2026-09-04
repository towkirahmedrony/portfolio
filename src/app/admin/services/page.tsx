import { AdminPage, AdminPlaceholderCard } from "@/components/admin/admin-page";

export default function AdminServicesPage() {
  return (
    <AdminPage
      title="Services Management"
      description="Define and manage the services and pricing offered to clients."
    >
      <AdminPlaceholderCard
        title="Services Database Connection"
        description="This module will fetch from services and service_features tables."
      />
    </AdminPage>
  );
}
