import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  formatClientProjectStatusLabel,
  formatDate,
  getStatusStyle,
} from "@/lib/admin-project-constants";
import {
  formatClientRequestStatusLabel,
  formatRequestBudget,
  getRequestStatusStyle,
} from "@/lib/admin-project-request-constants";
import {
  formatClientQuoteStatusLabel,
  getQuoteStatusStyle,
} from "@/lib/admin-quote-constants";
import {
  isQuoteAwaitingClient,
  type CustomerProjectRequestItem,
} from "@/lib/customer-project-requests";
import { formatMoney } from "@/lib/quote-money";

export function ProjectTracking({ items }: { items: CustomerProjectRequestItem[] }) {
  const projects = items.filter((item) => item.linkedProject);

  return (
    <Card className="hover:translate-y-0">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-xl tracking-tight">Active Projects</h3>
          <p className="mt-1 text-sm text-muted">
            Project execution status is separate from request review and quote status.
          </p>
        </div>
        <Badge>{`${projects.length} ${projects.length === 1 ? "Project" : "Projects"}`}</Badge>
      </div>

      <div className="mt-6">
        {projects.length === 0 ? (
          <div className="rounded-xl border border-dashed border-card-border p-6 text-center">
            <p className="text-sm text-muted">You have no active projects currently.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {projects.map((item) => {
              const project = item.linkedProject;
              if (!project) {
                return null;
              }
              const submittedBudget = formatRequestBudget(
                item.request.budget_min,
                item.request.budget_max,
                item.request.budget_currency || project.currency || "BDT",
              );

              return (
                <div
                  key={project.id}
                  className="flex flex-col gap-4 rounded-xl border border-card-border bg-background p-5 transition-colors hover:border-accent/30 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div>
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold tracking-wider text-accent uppercase">
                        {project.project_number}
                      </span>
                      <Badge className={getRequestStatusStyle(item.request.status)}>
                        {`Request: ${formatClientRequestStatusLabel(item.request.status)}`}
                      </Badge>
                      <Badge className={getStatusStyle(project.status)}>
                        {`Project: ${formatClientProjectStatusLabel(project.status)}`}
                      </Badge>
                      {item.quote ? (
                        <Badge className={getQuoteStatusStyle(item.quote.status)}>
                          {`Quote: ${formatClientQuoteStatusLabel(item.quote.status)}`}
                        </Badge>
                      ) : null}
                    </div>
                    <h4 className="font-display text-lg font-medium tracking-tight">{project.title}</h4>
                    {project.due_date ? (
                      <p className="mt-1 text-xs text-muted">
                        {`Target Delivery: ${new Date(project.due_date).toLocaleDateString()}`}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-col gap-4 border-t border-card-border pt-4 lg:items-end lg:border-t-0 lg:pt-0">
                    <div className="flex items-center gap-6 text-left lg:text-right">
                      <div>
                        <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted">
                          Your submitted budget
                        </p>
                        <p className="text-sm text-muted">{submittedBudget}</p>
                      </div>
                      <div>
                        <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted">
                          Current quote
                        </p>
                        <p className="text-sm font-medium">
                          {item.quote
                            ? formatMoney(item.quote.total, item.quote.currency)
                            : "No admin quote yet"}
                        </p>
                      </div>
                      <div>
                        <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted">
                          Last updated
                        </p>
                        <p className="text-sm">
                          {formatDate(item.quote?.updated_at || project.updated_at || item.request.updated_at)}
                        </p>
                      </div>
                    </div>
                    <Link
                      href={`/profile/projects/${project.id}`}
                      className="inline-flex w-fit items-center justify-center rounded-md bg-accent/10 px-4 py-2 text-xs font-bold text-accent transition-colors hover:bg-accent hover:text-white"
                    >
                      {isQuoteAwaitingClient(item.quote) ? "Review Quote" : "View Details"}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}
