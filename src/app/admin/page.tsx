import { AdminPage, AdminPlaceholderCard } from "@/components/admin/admin-page";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function AdminDashboardPage() {
  const supabase = await createServerSupabaseClient();

  // Fetch real counts from the database
  const [
    { count: projectsCount, error: projectsError },
    { count: requestsCount, error: requestsError },
  ] = await Promise.all([
    supabase.from("projects").select("*", { count: "exact", head: true }),
    supabase.from("project_requests").select("*", { count: "exact", head: true }),
  ]);

  return (
    <AdminPage
      title="Dashboard"
      description="Overview of your projects and incoming requests."
    >
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <AdminPlaceholderCard
          title="Total Projects"
          description={
            projectsError
              ? "Error loading projects"
              : `${projectsCount || 0} active projects`
          }
        />
        <AdminPlaceholderCard
          title="Project Requests"
          description={
            requestsError
              ? "Error loading requests"
              : `${requestsCount || 0} pending requests`
          }
        />
        <AdminPlaceholderCard
          title="Invoices"
          description="Invoicing feature coming soon."
        />
        <AdminPlaceholderCard
          title="Clients"
          description="Client management coming soon."
        />
      </div>
    </AdminPage>
  );
}
