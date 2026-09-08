import { Suspense } from "react";
import { AdminPage } from "@/components/admin/admin-page";
import {
  ActionItemGrid,
  ActivityFeed,
  ClientQuoteResponses,
  DashboardSection,
  DashboardSkeleton,
  StatCardGrid,
} from "@/components/admin/dashboard";
import { getAdminDashboardData } from "@/lib/admin-dashboard";
import { requireAdmin } from "@/lib/require-admin";

async function AdminDashboardContent() {
  const user = await requireAdmin();
  const dashboard = await getAdminDashboardData(user.id);

  return (
    <div className="space-y-10">
      <DashboardSection
        title="Today's Snapshot"
        description="Live counts from project requests, projects, invoices, and payments."
      >
        <StatCardGrid metrics={dashboard.metrics} />
      </DashboardSection>

      <DashboardSection
        title="Action Needed"
        description="Queues that still need an admin response. Detail pages will be added later."
      >
        <ActionItemGrid items={dashboard.actions} />
      </DashboardSection>

      <DashboardSection
        title="Client Quote Responses"
        description="Quote Accepted, Quote Rejected, and Quote Change Requested decisions from clients, with the project (PJ-...) or request (PR-...) they belong to. Unanswered change requests are flagged and open the exact project or quote."
      >
        <ClientQuoteResponses responses={dashboard.quoteResponses} />
      </DashboardSection>

      <DashboardSection
        title="Recent Activity"
        description="Latest rows from audit_logs, showing actor, action, entity, and time."
      >
        <ActivityFeed activity={dashboard.activity} />
      </DashboardSection>
    </div>
  );
}

export default function AdminDashboardPage() {
  return (
    <AdminPage
      title="Dashboard"
      description="Today's snapshot, items that need attention, and recent audit activity."
    >
      <Suspense fallback={<DashboardSkeleton />}>
        <AdminDashboardContent />
      </Suspense>
    </AdminPage>
  );
}
