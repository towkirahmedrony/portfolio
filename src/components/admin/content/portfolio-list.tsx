import Link from "next/link";
import type { PortfolioProjectRow } from "@/types/database";
import { formatDate } from "@/lib/admin-content-constants";
import {
  deletePortfolioProject,
  reorderPortfolioProject,
  setPortfolioFlag,
} from "@/lib/admin-content-actions";
import { StatusPill } from "@/components/admin/projects/query-state";
import { DeleteActionForm, FlagToggle, ReorderForm } from "@/components/admin/content/content-common";

export function PortfolioProjectsTable({
  projects,
}: {
  projects: PortfolioProjectRow[];
}) {
  return (
    <div className="overflow-x-auto rounded-3xl border border-card-border bg-card">
      <table className="w-full min-w-[64rem] text-left text-sm">
        <thead className="border-b border-card-border text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-4 py-3">Project</th>
            <th className="px-4 py-3">Category</th>
            <th className="px-4 py-3">State</th>
            <th className="px-4 py-3">Order</th>
            <th className="px-4 py-3">Created</th>
            <th className="px-4 py-3" aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {projects.map((project, index) => (
            <tr
              key={project.id}
              className="border-b border-card-border/60 last:border-0 hover:bg-foreground/[0.02]"
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  {project.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={project.thumbnail_url.trim()}
                      alt=""
                      className="h-10 w-14 shrink-0 rounded-lg border border-card-border object-cover"
                    />
                  ) : null}
                  <div>
                    <Link
                      href={`/admin/portfolio/${project.id}`}
                      className="font-medium text-foreground hover:underline"
                    >
                      {project.title}
                    </Link>
                    <div className="font-mono text-xs text-muted">{project.slug}</div>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 text-muted">{project.category || "—"}</td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1.5">
                  <FlagToggle
                    action={setPortfolioFlag}
                    hidden={{ projectId: project.id, flag: "published" }}
                    active={project.published}
                    activeLabel="Published"
                    inactiveLabel="Draft"
                    activeClass="border-transparent bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                    inactiveClass="border-card-border bg-background text-muted"
                  />
                  <FlagToggle
                    action={setPortfolioFlag}
                    hidden={{ projectId: project.id, flag: "featured" }}
                    active={project.featured}
                    activeLabel="Featured"
                    inactiveLabel="Not featured"
                    activeClass="border-transparent bg-accent-soft text-accent"
                    inactiveClass="border-card-border bg-background text-muted"
                  />
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted">{project.sort_order}</span>
                  <ReorderForm
                    action={reorderPortfolioProject}
                    hidden={{ projectId: project.id }}
                    direction="up"
                    disabled={index === 0}
                    label={`Move ${project.title} up`}
                  />
                  <ReorderForm
                    action={reorderPortfolioProject}
                    hidden={{ projectId: project.id }}
                    direction="down"
                    disabled={index === projects.length - 1}
                    label={`Move ${project.title} down`}
                  />
                </div>
              </td>
              <td className="px-4 py-3 text-muted">{formatDate(project.created_at)}</td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-2">
                  <Link
                    href={`/admin/portfolio/${project.id}`}
                    className="text-xs font-medium text-foreground underline-offset-2 hover:underline"
                  >
                    Edit
                  </Link>
                  <DeleteActionForm
                    action={deletePortfolioProject}
                    hidden={{ projectId: project.id }}
                    confirmMessage={`Delete "${project.title}"? This also removes its gallery images.`}
                    label="Delete"
                    successMessage="Project deleted."
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function EmptyTableState({
  message,
  addHref,
  addLabel,
}: {
  message: string;
  addHref: string;
  addLabel: string;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-card-border bg-card p-8 text-center">
      <p className="text-sm text-muted">{message}</p>
      <Link
        href={addHref}
        className="mt-3 inline-block rounded-xl border border-card-border px-3 py-2 text-sm font-medium text-foreground hover:border-foreground"
      >
        {addLabel}
      </Link>
    </div>
  );
}

export function InlinePill({ label }: { label: string }) {
  return (
    <StatusPill
      label={label}
      className="border-transparent bg-foreground/[0.06] text-muted"
    />
  );
}
