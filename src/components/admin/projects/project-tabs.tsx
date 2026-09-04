import Link from "next/link";
import { PROJECT_DETAIL_TABS, type ProjectDetailTab } from "@/lib/admin-project-constants";

const TAB_LABELS: Record<ProjectDetailTab, string> = {
  overview: "Overview",
  requirements: "Requirements",
  milestones: "Milestones",
  files: "Files",
  notes: "Internal notes",
  messages: "Messages",
  financial: "Financial",
  history: "Status history",
};

export function ProjectTabs({
  projectId,
  active,
}: {
  projectId: string;
  active: ProjectDetailTab;
}) {
  return (
    <nav className="mb-6 flex flex-wrap gap-2" aria-label="Project sections">
      {PROJECT_DETAIL_TABS.map((tab) => (
        <Link
          key={tab}
          href={`/admin/projects/${projectId}?tab=${tab}`}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            active === tab
              ? "border-foreground bg-foreground text-background"
              : "border-card-border text-muted hover:text-foreground"
          }`}
        >
          {TAB_LABELS[tab]}
        </Link>
      ))}
    </nav>
  );
}
