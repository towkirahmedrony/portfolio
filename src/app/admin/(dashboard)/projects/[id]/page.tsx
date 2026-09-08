import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminPage } from "@/components/admin/admin-page";
import { ProjectTabs } from "@/components/admin/projects/project-tabs";
import { QueryStateNotice, StatusPill } from "@/components/admin/projects/query-state";
import { ProjectOverviewTab } from "@/components/admin/projects/tab-overview";
import { ProjectRequirementsTab } from "@/components/admin/projects/tab-requirements";
import { ProjectMilestonesTab } from "@/components/admin/projects/tab-milestones";
import { ProjectFilesTab } from "@/components/admin/projects/tab-files";
import { ProjectNotesTab } from "@/components/admin/projects/tab-notes";
import { ProjectMessagesTab } from "@/components/admin/projects/tab-messages";
import { ProjectFinancialTab } from "@/components/admin/projects/tab-financial";
import { ProjectHistoryTab } from "@/components/admin/projects/tab-history";
import {
  clientDisplayName,
  formatPriorityLabel,
  formatStatusLabel,
  getAdminProject,
  getProjectFiles,
  getProjectFinancials,
  getProjectMilestones,
  getProjectNotes,
  getProjectRequirements,
  getProjectStatusHistory,
  getPriorityStyle,
  getStatusStyle,
  isProjectDetailTab,
  type AdminProjectListItem,
  type ProjectDetailTab,
  type QueryResult,
} from "@/lib/admin-projects";
import { getProjectQuoteChangeRequests } from "@/lib/admin-quote-responses";
import { requireAdmin } from "@/lib/require-admin";
import type { ReactNode } from "react";

/**
 * Loads the active tab's data. Each tab getter only needs the project id (the
 * route param), never the project header row — so it can run concurrently
 * with getAdminProject() instead of waiting for it. The messages tab is the
 * exception: it renders the realtime chat, which needs the project header
 * (reference + client) fetched above, and loads its own history client-side.
 */
async function loadTabContent(tab: string, projectId: string): Promise<ReactNode> {
  switch (tab) {
    case "requirements":
      return (
        <ProjectRequirementsTab
          projectId={projectId}
          result={await getProjectRequirements(projectId)}
        />
      );
    case "milestones":
      return (
        <ProjectMilestonesTab
          projectId={projectId}
          result={await getProjectMilestones(projectId)}
        />
      );
    case "files":
      return <ProjectFilesTab projectId={projectId} result={await getProjectFiles(projectId)} />;
    case "notes":
      return <ProjectNotesTab projectId={projectId} result={await getProjectNotes(projectId)} />;
    case "financial": {
      const financials = await getProjectFinancials(projectId);
      return <ProjectFinancialTab {...financials} />;
    }
    case "history":
      return <ProjectHistoryTab result={await getProjectStatusHistory(projectId)} />;
    default:
      return null;
  }
}

function renderProjectShell(
  projectResult: QueryResult<AdminProjectListItem>,
  content: (project: AdminProjectListItem) => ReactNode,
  activeTab: ProjectDetailTab,
) {
  if (projectResult.status === "empty") {
    notFound();
  }

  if (projectResult.status === "error" || projectResult.status === "unavailable") {
    return (
      <AdminPage
        title="Project"
        description="Could not load this project."
        className="mx-auto w-full max-w-6xl"
      >
        <QueryStateNotice result={projectResult} />
      </AdminPage>
    );
  }

  const project = projectResult.data;

  return (
    <AdminPage
      title={project.title}
      description={project.project_number}
      className="mx-auto w-full max-w-6xl"
    >
      <Link
        href="/admin/projects"
        className="mb-6 inline-block text-sm text-muted hover:text-foreground"
      >
        Back to all projects
      </Link>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <StatusPill
          label={formatStatusLabel(project.status)}
          className={getStatusStyle(project.status)}
        />
        <StatusPill
          label={formatPriorityLabel(project.priority)}
          className={getPriorityStyle(project.priority)}
        />
        <span className="text-sm text-muted">{clientDisplayName(project.client)}</span>
      </div>
      <ProjectTabs projectId={project.id} active={activeTab} />
      {content(project)}
    </AdminPage>
  );
}

export default async function AdminProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const { tab: tabParam } = await searchParams;
  const tab: ProjectDetailTab =
    tabParam && isProjectDetailTab(tabParam) ? tabParam : "overview";

  if (tab === "messages") {
    // The realtime chat needs the project header row (number/title/client).
    const [projectResult, changeRequests] = await Promise.all([
      getAdminProject(id),
      getProjectQuoteChangeRequests(id),
    ]);
    return renderProjectShell(
      projectResult,
      (project) => <ProjectMessagesTab project={project} changeRequests={changeRequests} />,
      tab,
    );
  }

  const [projectResult, tabContent] = await Promise.all([
    getAdminProject(id),
    loadTabContent(tab, id),
  ]);

  return renderProjectShell(
    projectResult,
    (project) =>
      tab === "overview" ? (
        <ProjectOverviewTab project={project} />
      ) : (
        (tabContent as ReactNode)
      ),
    tab,
  );
}
