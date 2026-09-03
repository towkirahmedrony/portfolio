import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ProjectRow } from "@/types/database";

type ProjectWithFinancials = ProjectRow & {
  invoices?: { amount_paid: number; amount_due: number }[];
};

export async function ProjectTracking() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("projects")
    .select(`*, invoices(amount_paid, amount_due)`)
    .eq("client_id", user.id)
    .order("created_at", { ascending: false });

  const projects = (data || []) as ProjectWithFinancials[];

  return (
    <Card className="hover:translate-y-0">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-xl tracking-tight">Active Projects</h3>
          <p className="mt-1 text-sm text-muted">Track your ongoing projects, financial status, and development progress.</p>
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
              const totalPaid = item.invoices?.reduce((sum, inv) => sum + Number(inv.amount_paid || 0), 0) || 0;
              const totalDue = item.invoices?.reduce((sum, inv) => sum + Number(inv.amount_due || 0), 0) || 0;

              return (
                <div key={item.id} className="flex flex-col gap-4 rounded-xl border border-card-border bg-background p-5 transition-colors hover:border-accent/30 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-semibold tracking-wider text-accent uppercase">{item.project_number}</span>
                      <Badge>{item.status.replace("_", " ")}</Badge>
                      {item.priority && <span className="text-[10px] uppercase font-semibold text-muted border border-card-border px-1.5 py-0.5 rounded">{item.priority}</span>}
                    </div>
                    <h4 className="font-display text-lg tracking-tight font-medium">{item.title}</h4>
                    {item.due_date && <p className="mt-1 text-xs text-muted">Target Delivery: {new Date(item.due_date).toLocaleDateString()}</p>}
                  </div>

                  <div className="flex flex-col lg:items-end gap-4 border-t border-card-border pt-4 lg:border-t-0 lg:pt-0">
                    <div className="flex items-center gap-6 text-left lg:text-right">
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-wider text-muted mb-1">Total</p>
                        <p className="text-sm font-medium">{`${item.agreed_price || item.estimated_budget || 0} ${item.currency}`}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-wider text-muted mb-1">Paid</p>
                        <p className="text-sm font-medium text-emerald-500">{`${totalPaid} ${item.currency}`}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-wider text-muted mb-1">Due</p>
                        <p className="text-sm font-medium text-destructive">{`${totalDue} ${item.currency}`}</p>
                      </div>
                    </div>
                    {/* View Details Button */}
                    <Link href={`/profile/projects/${item.id}`} className="inline-flex w-fit items-center justify-center rounded-md bg-accent/10 px-4 py-2 text-xs font-bold text-accent transition-colors hover:bg-accent hover:text-white">
                      View Details &rarr;
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
