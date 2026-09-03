"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { ProjectRow } from "@/types/database";

type ProjectWithFinancials = ProjectRow & {
  invoices?: { amount_paid: number; amount_due: number }[];
};

export function ProjectTracking() {
  const [projects, setProjects] = useState<ProjectWithFinancials[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProjects() {
      try {
        const supabase = createBrowserSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from("projects")
          .select(`
            *,
            invoices (
              amount_paid,
              amount_due
            )
          `)
          .eq("client_id", user.id)
          .order("created_at", { ascending: false });

        if (!error && data) {
          setProjects(data as ProjectWithFinancials[]);
        }
      } catch (err) {
        console.error("Error loading client projects:", err);
      } finally {
        setLoading(false);
      }
    }

    void loadProjects();
  }, []);

  return (
    <Card className="hover:translate-y-0">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-xl tracking-tight">Active Projects</h3>
          <p className="mt-1 text-sm text-muted">
            Track your ongoing projects, financial status, and development progress.
          </p>
        </div>
        <Badge>{`${projects.length} ${projects.length === 1 ? "Project" : "Projects"}`}</Badge>
      </div>

      <div className="mt-6">
        {loading ? (
          <p className="text-sm text-muted">Loading your projects…</p>
        ) : projects.length === 0 ? (
          <div className="rounded-xl border border-dashed border-card-border p-6 text-center">
            <p className="text-sm text-muted">You have no active projects currently.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {projects.map((item) => {
              const totalPaid = item.invoices?.reduce((sum, inv) => sum + Number(inv.amount_paid || 0), 0) || 0;
              const totalDue = item.invoices?.reduce((sum, inv) => sum + Number(inv.amount_due || 0), 0) || 0;

              return (
                <Link key={item.id} href={`/profile/projects/${item.id}`} className="block focus:outline-none">
                  <div className="flex flex-col gap-4 rounded-xl border border-card-border bg-background p-5 transition-colors hover:border-accent hover:bg-accent/5 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold tracking-wider text-accent uppercase">
                          {item.project_number}
                        </span>
                        <Badge>
                          {item.status.replace("_", " ")}
                        </Badge>
                        {item.priority && (
                          <span className="text-[10px] uppercase font-semibold text-muted border border-card-border px-1.5 py-0.5 rounded">
                            {item.priority}
                          </span>
                        )}
                      </div>
                      <h4 className="font-display text-base tracking-tight font-medium">
                        {item.title}
                      </h4>
                      {item.due_date && (
                        <p className="mt-1 text-xs text-muted">
                          Target Delivery: {new Date(item.due_date).toLocaleDateString()}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-6 text-left lg:text-right border-t border-card-border pt-3 lg:border-t-0 lg:pt-0">
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-wider text-muted mb-1">Total</p>
                        <p className="text-sm font-medium">{`${(item.agreed_price || item.estimated_budget || 0)} ${item.currency}`}</p>
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
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}
