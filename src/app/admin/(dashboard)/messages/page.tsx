import { AdminPage, AdminPlaceholderCard } from "@/components/admin/admin-page";

export default function AdminMessagesPage() {
  return (
    <AdminPage
      title="Contact Messages"
      description="View and reply to messages submitted through the public contact form."
    >
      <AdminPlaceholderCard
        title="Messages Database Connection"
        description="This module will fetch from the contact_messages table."
      />
    </AdminPage>
  );
}
