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
  getProjectMessages,
  getProjectMilestones,
  getProjectNotes,
  getProjectRequirements,
  getProjectStatusHistory,
  getPriorityStyle,
  getStatusStyle,
  isProjectDetailTab,
} from "@/lib/admin-projects";
import { requireAdmin } from "@/lib/require-admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

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
  const tab = tabParam && isProjectDetailTab(tabParam) ? tabParam : "overview";
  const projectResult = await getAdminProject(id);

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

  // Show the originating request number so the PR -> PJ relationship is
  // visible from the project side too.
  let originRequest: { id: string; request_number: string } | null = null;
  if (project.request_id) {
    const supabase = await createServerSupabaseClient();
    const { data: request } = await supabase
      .from("project_requests")
      .select("id, request_number")
      .eq("id", project.request_id)
      .maybeSingle();
    originRequest = request ?? null;
  }
  let tabContent = <ProjectOverviewTab project={project} />;

  if (tab === "requirements") {
    tabContent = (
      <ProjectRequirementsTab
        projectId={project.id}
        result={await getProjectRequirements(project.id)}
      />
    );
  } else if (tab === "milestones") {
    tabContent = (
      <ProjectMilestonesTab
        projectId={project.id}
        result={await getProjectMilestones(project.id)}
      />
    );
  } else if (tab === "files") {
    tabContent = (
      <ProjectFilesTab projectId={project.id} result={await getProjectFiles(project.id)} />
    );
  } else if (tab === "notes") {
    tabContent = (
      <ProjectNotesTab projectId={project.id} result={await getProjectNotes(project.id)} />
    );
  } else if (tab === "messages") {
    tabContent = (
      <ProjectMessagesTab
        projectId={project.id}
        result={await getProjectMessages(project.id)}
      />
    );
  } else if (tab === "financial") {
    tabContent = <ProjectFinancialTab {...await getProjectFinancials(project.id)} />;
  } else if (tab === "history") {
    tabContent = <ProjectHistoryTab result={await getProjectStatusHistory(project.id)} />;
  }

  return (
    <AdminPage
      title={project.title}
      description={`Project #${project.project_number}`}
      className="mx-auto w-full max-w-6xl"
    >
      <Link
        href="/admin/projects"
        className="mb-6 inline-block text-sm text-muted hover:text-foreground"
      >
        Back to all projects
      </Link>
      {originRequest ? (
        <p className="mb-4 text-sm text-muted">
          Created from request{" "}
          <Link
            href={`/admin/project-requests/${originRequest.id}`}
            className="font-medium text-foreground hover:underline"
          >
            {originRequest.request_number}
          </Link>
        </p>
      ) : null}
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
      <ProjectTabs projectId={project.id} active={tab} />
      {tabContent}
    </AdminPage>
  );
}
