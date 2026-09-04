import { AdminPage, AdminPlaceholderCard } from "@/components/admin/admin-page";

export default function AdminReviewsPage() {
  return (
    <AdminPage
      title="Reviews & Testimonials"
      description="Approve and manage client reviews."
    >
      <AdminPlaceholderCard
        title="Reviews Database Connection"
        description="This module will fetch from the reviews table."
      />
    </AdminPage>
  );
}
