import type {
  FileCategory,
  MilestoneStatus,
  ProfileRow,
  ProjectPriority,
  ProjectRow,
  ProjectStatus,
} from "@/types/database";

export const PROJECT_STATUSES: ProjectStatus[] = [
  "pending",
  "approved",
  "in_progress",
  "on_hold",
  "in_review",
  "revision",
  "completed",
  "cancelled",
];

export const PROJECT_PRIORITIES: ProjectPriority[] = [
  "low",
  "normal",
  "high",
  "urgent",
];

export const MILESTONE_STATUSES: MilestoneStatus[] = [
  "pending",
  "in_progress",
  "completed",
  "skipped",
];

export const FILE_CATEGORIES: FileCategory[] = [
  "design",
  "logo",
  "content",
  "document",
  "attachment",
  "deliverable",
  "other",
];

export const PROJECT_FILE_BUCKET = "project-files";

export const PROJECT_SORT_FIELDS = [
  "created_at",
  "updated_at",
  "project_number",
  "title",
  "status",
  "priority",
  "due_date",
  "start_date",
  "agreed_price",
] as const;

export type ProjectSortField = (typeof PROJECT_SORT_FIELDS)[number];
export type ProjectListView = "list" | "kanban";

export type ProjectListFilters = {
  q?: string;
  status?: string;
  priority?: string;
  sort?: string;
  dir?: string;
  view?: string;
};

export type ProjectClient = Pick<
  ProfileRow,
  "id" | "full_name" | "display_name" | "company_name" | "avatar_url"
>;

export type AdminProjectListItem = ProjectRow & {
  client: ProjectClient | null;
};

export type QueryResult<T> =
  | { status: "ok"; data: T }
  | { status: "empty"; data: T }
  | { status: "error"; message: string }
  | { status: "unavailable"; message: string };

export const PROJECT_DETAIL_TABS = [
  "overview",
  "requirements",
  "milestones",
  "files",
  "notes",
  "messages",
  "financial",
  "history",
] as const;

export type ProjectDetailTab = (typeof PROJECT_DETAIL_TABS)[number];

const STATUS_LABELS: Record<ProjectStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  in_progress: "In progress",
  on_hold: "On hold",
  in_review: "In review",
  revision: "Revision",
  completed: "Completed",
  cancelled: "Cancelled",
};

const PRIORITY_LABELS: Record<ProjectPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

export const PROJECT_STATUS_STYLES: Record<ProjectStatus, string> = {
  pending: "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400",
  approved: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400",
  in_progress: "bg-blue-500/10 text-blue-700 border-blue-500/20 dark:text-blue-400",
  on_hold: "bg-orange-500/10 text-orange-700 border-orange-500/20 dark:text-orange-400",
  in_review: "bg-purple-500/10 text-purple-700 border-purple-500/20 dark:text-purple-400",
  revision: "bg-pink-500/10 text-pink-700 border-pink-500/20 dark:text-pink-400",
  completed: "bg-teal-500/10 text-teal-700 border-teal-500/20 dark:text-teal-400",
  cancelled: "bg-neutral-500/10 text-neutral-500 border-neutral-500/20",
};

export const PROJECT_PRIORITY_STYLES: Record<ProjectPriority, string> = {
  low: "bg-neutral-500/10 text-neutral-600 border-neutral-500/20",
  normal: "bg-blue-500/10 text-blue-700 border-blue-500/20 dark:text-blue-400",
  high: "bg-orange-500/10 text-orange-700 border-orange-500/20 dark:text-orange-400",
  urgent: "bg-red-500/10 text-red-700 border-red-500/20 dark:text-red-400",
};

export function isProjectStatus(value: string): value is ProjectStatus {
  return PROJECT_STATUSES.includes(value as ProjectStatus);
}

export function isProjectPriority(value: string): value is ProjectPriority {
  return PROJECT_PRIORITIES.includes(value as ProjectPriority);
}

export function isMilestoneStatus(value: string): value is MilestoneStatus {
  return MILESTONE_STATUSES.includes(value as MilestoneStatus);
}

export function isFileCategory(value: string): value is FileCategory {
  return FILE_CATEGORIES.includes(value as FileCategory);
}

export function isProjectSortField(value: string): value is ProjectSortField {
  return PROJECT_SORT_FIELDS.includes(value as ProjectSortField);
}

export function isProjectDetailTab(value: string): value is ProjectDetailTab {
  return PROJECT_DETAIL_TABS.includes(value as ProjectDetailTab);
}

export function formatStatusLabel(status: string): string {
  if (isProjectStatus(status)) {
    return STATUS_LABELS[status];
  }
  return status.replace(/_/g, " ");
}

export function formatPriorityLabel(priority: string): string {
  if (isProjectPriority(priority)) {
    return PRIORITY_LABELS[priority];
  }
  return priority;
}

export function getPriorityStyle(priority: string): string {
  return isProjectPriority(priority)
    ? PROJECT_PRIORITY_STYLES[priority]
    : "border-card-border bg-background text-muted";
}

export function getStatusStyle(status: string): string {
  return isProjectStatus(status)
    ? PROJECT_STATUS_STYLES[status]
    : "border-card-border bg-background text-muted";
}

export function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  return `${parseFloat((bytes / 1024 ** index).toFixed(2))} ${units[index]}`;
}

export function clientDisplayName(client: ProjectClient | null): string {
  if (!client) {
    return "Unknown client";
  }
  return client.display_name?.trim() || client.full_name.trim() || "Unknown client";
}

export function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }
        if (item && typeof item === "object" && "name" in item) {
          return String((item as { name: unknown }).name);
        }
        return JSON.stringify(item);
      })
      .filter(Boolean);
  }

  if (typeof value === "string" && value.trim()) {
    try {
      return asStringList(JSON.parse(value));
    } catch {
      return [value];
    }
  }

  return [];
}

export function buildProjectsHref(filters: ProjectListFilters): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.status && filters.status !== "all") params.set("status", filters.status);
  if (filters.priority && filters.priority !== "all") params.set("priority", filters.priority);
  if (filters.sort && filters.sort !== "created_at") params.set("sort", filters.sort);
  if (filters.dir && filters.dir !== "desc") params.set("dir", filters.dir);
  if (filters.view && filters.view !== "list") params.set("view", filters.view);
  const query = params.toString();
  return query ? `/admin/projects?${query}` : "/admin/projects";
}
