import { Suspense } from "react";
import { AdminPage } from "@/components/admin/admin-page";
import {
  ActionItemGrid,
  ActivityFeed,
  DashboardSection,
  DashboardSkeleton,
  StatCardGrid,
} from "@/components/admin/dashboard";
import { getAdminDashboardData } from "@/lib/admin-dashboard";

async function AdminDashboardContent() {
  const dashboard = await getAdminDashboardData();

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
