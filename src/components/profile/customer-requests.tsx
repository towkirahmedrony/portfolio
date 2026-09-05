import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/admin-project-constants";
import {
  formatRequestStatusLabel,
  getRequestStatusStyle,
} from "@/lib/admin-project-request-constants";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { RequestStatus } from "@/types/database";

type CustomerRequestRow = {
  id: string;
  request_number: string;
  project_type: string | null;
  status: RequestStatus;
  submitted_at: string;
};

export async function CustomerRequests() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return null;
  }

  const { data } = await supabase
    .from("project_requests")
    .select("id, request_number, project_type, status, submitted_at")
    .eq("client_id", user.id)
    .order("submitted_at", { ascending: false });

  const requests = (data ?? []) as CustomerRequestRow[];

  return (
    <Card className="hover:translate-y-0">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-xl tracking-tight">Project Requests</h3>
          <p className="mt-1 text-sm text-muted">
            Orders you submitted from the start-project form.
          </p>
        </div>
        <Badge>
          {`${requests.length} ${requests.length === 1 ? "Request" : "Requests"}`}
        </Badge>
      </div>

      <div className="mt-6">
        {requests.length === 0 ? (
          <div className="rounded-xl border border-dashed border-card-border p-6 text-center">
            <p className="text-sm text-muted">
              You have not submitted a project request yet.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {requests.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-3 rounded-xl border border-card-border bg-background p-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold tracking-wider text-accent uppercase">
                      {item.request_number}
                    </span>
                    <Badge className={getRequestStatusStyle(item.status)}>
                      {formatRequestStatusLabel(item.status)}
                    </Badge>
                  </div>
                  <h4 className="font-display text-lg tracking-tight font-medium">
                    {item.project_type || "Project request"}
                  </h4>
                  <p className="mt-1 text-xs text-muted">
                    Submitted {formatDate(item.submitted_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
