import { Suspense } from "react";
import { AdminPage } from "@/components/admin/admin-page";
import { AdminMessagesSummaryCard } from "@/components/admin/admin-messaging";
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
        description="Live counts from project requests, projects, invoices, and payments. Open a card to jump to that list."
      >
        <StatCardGrid metrics={dashboard.metrics} />
      </DashboardSection>

      <DashboardSection
        title="Messages"
        description="Unread client messages across projects and project requests. The count updates live — no refresh needed."
        href="/admin/messages"
        actionLabel="View Messages"
      >
        <AdminMessagesSummaryCard />
      </DashboardSection>

      <DashboardSection
        title="Action Needed"
        description="Queues that still need an admin response. Open a card to jump to that list."
      >
        <ActionItemGrid items={dashboard.actions} />
      </DashboardSection>

      <DashboardSection
        title="Client Quote Responses"
        description="Quote Accepted, Quote Rejected, and Quote Change Requested decisions from clients, with the project (PJ-...) or request (PR-...) they belong to. Unanswered change requests are flagged and open the exact project or quote."
        href="/admin/quotes"
        actionLabel="View all"
      >
        <ClientQuoteResponses responses={dashboard.quoteResponses} />
      </DashboardSection>

      <DashboardSection
        title="Recent Activity"
        description="Latest rows from audit_logs, showing actor, action, entity, and time."
        href="/admin/audit-logs"
        actionLabel="View all"
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
