import Link from "next/link";
import {
  EMAIL_VERIFIED_STYLES,
  formatClientStatusLabel,
  formatDate,
  formatDateTime,
  getClientStatusStyle,
  type AdminClientListData,
} from "@/lib/admin-client-constants";
import { StatusPill } from "@/components/admin/projects/query-state";

export function ClientNameLink({ clientId, fullName }: { clientId: string; fullName: string }) {
  return (
    <Link
      href={`/admin/clients/${clientId}`}
      className="font-medium text-foreground hover:underline"
    >
      {fullName || "Unnamed client"}
    </Link>
  );
}

export function ClientsListTable({ data }: { data: AdminClientListData }) {
  return (
    <div className="overflow-x-auto rounded-3xl border border-card-border bg-card">
      <table className="w-full min-w-[88rem] text-left text-sm">
        <thead className="border-b border-card-border text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Display name</th>
            <th className="px-4 py-3">Email</th>
            <th className="px-4 py-3">Phone</th>
            <th className="px-4 py-3">Company</th>
            <th className="px-4 py-3">Job title</th>
            <th className="px-4 py-3">Account status</th>
            <th className="px-4 py-3">Email verified</th>
            <th className="px-4 py-3">Member since</th>
            <th className="px-4 py-3">Last active</th>
            <th className="px-4 py-3" aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {data.items.map((client) => (
            <tr
              key={client.id}
              className="border-b border-card-border/60 last:border-0 hover:bg-foreground/[0.02]"
            >
              <td className="px-4 py-3">
                <ClientNameLink clientId={client.id} fullName={client.full_name} />
              </td>
              <td className="px-4 py-3 text-foreground">
                {client.display_name?.trim() || "—"}
              </td>
              <td className="px-4 py-3 text-foreground">{client.email ?? "—"}</td>
              <td className="px-4 py-3 text-muted">{client.phone || "—"}</td>
              <td className="px-4 py-3 text-muted">{client.company_name || "—"}</td>
              <td className="px-4 py-3 text-muted">{client.job_title || "—"}</td>
              <td className="px-4 py-3">
                <StatusPill
                  label={formatClientStatusLabel(client.status)}
                  className={getClientStatusStyle(client.status)}
                />
              </td>
              <td className="px-4 py-3">
                <StatusPill
                  label={client.email_verified ? "Verified" : "Unverified"}
                  className={
                    client.email_verified
                      ? EMAIL_VERIFIED_STYLES.verified
                      : EMAIL_VERIFIED_STYLES.unverified
                  }
                />
              </td>
              <td className="px-4 py-3 text-muted">{formatDate(client.created_at)}</td>
              <td className="px-4 py-3 text-muted">
                {formatDateTime(client.last_seen_at)}
              </td>
              <td className="px-4 py-3 text-right">
                <Link
                  href={`/admin/clients/${client.id}`}
                  className="text-xs font-medium text-foreground underline-offset-2 hover:underline"
                >
                  View
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
