import Link from "next/link";
import { StatusPill } from "@/components/admin/projects/query-state";
import {
  formatPercentLabel,
  formatReferralStatusLabel,
  formatDate,
  getReferralStatusStyle,
  personDisplayName,
  type AdminReferralListItem,
} from "@/lib/admin-referral-constants";

function PersonCell({ person }: { person: AdminReferralListItem["referrer"] }) {
  if (!person) {
    return <span className="text-muted">Unknown</span>;
  }
  return (
    <div>
      <div className="text-foreground">{personDisplayName(person)}</div>
      {person.company_name ? (
        <div className="text-xs text-muted">{person.company_name}</div>
      ) : null}
    </div>
  );
}

export function ReferralsListTable({ items }: { items: AdminReferralListItem[] }) {
  return (
    <div className="overflow-x-auto rounded-3xl border border-card-border bg-card">
      <table className="w-full min-w-[76rem] text-left text-sm">
        <thead className="border-b border-card-border text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-4 py-3">Referrer</th>
            <th className="px-4 py-3">Referral code</th>
            <th className="px-4 py-3">Referred client</th>
            <th className="px-4 py-3">Project / request</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Client discount</th>
            <th className="px-4 py-3">Referrer reward</th>
            <th className="px-4 py-3">Created</th>
            <th className="px-4 py-3">Completed</th>
          </tr>
        </thead>
        <tbody>
          {items.map((referral) => (
            <tr
              key={referral.id}
              className="border-b border-card-border/60 last:border-0 hover:bg-foreground/[0.02]"
            >
              <td className="px-4 py-3">
                <Link
                  href={`/admin/referrals/${referral.id}`}
                  className="font-medium text-foreground hover:underline"
                >
                  {personDisplayName(referral.referrer)}
                </Link>
              </td>
              <td className="px-4 py-3">
                {referral.code ? (
                  <span className="font-mono text-xs text-foreground">{referral.code}</span>
                ) : (
                  <span className="text-muted">—</span>
                )}
              </td>
              <td className="px-4 py-3">
                {referral.referredClient ? (
                  <PersonCell person={referral.referredClient} />
                ) : (
                  <span className="text-muted">No client yet</span>
                )}
              </td>
              <td className="px-4 py-3">
                {referral.projectNumber ? (
                  <div>
                    <Link
                      href={`/admin/projects/${referral.first_project_id}`}
                      className="text-foreground hover:underline"
                    >
                      {referral.projectNumber}
                    </Link>
                    <div className="text-xs text-muted">{referral.projectTitle}</div>
                  </div>
                ) : referral.requestNumber ? (
                  <Link
                    href={`/admin/project-requests/${referral.project_request_id}`}
                    className="text-foreground hover:underline"
                  >
                    {referral.requestNumber}
                  </Link>
                ) : (
                  <span className="text-muted">—</span>
                )}
              </td>
              <td className="px-4 py-3">
                <StatusPill
                  label={formatReferralStatusLabel(referral.status)}
                  className={getReferralStatusStyle(referral.status)}
                />
              </td>
              <td className="px-4 py-3 text-muted">
                {formatPercentLabel(referral.client_discount_percent)}
              </td>
              <td className="px-4 py-3 text-muted">
                {formatPercentLabel(referral.referrer_reward_percent)}
              </td>
              <td className="px-4 py-3 text-muted">{formatDate(referral.created_at)}</td>
              <td className="px-4 py-3 text-muted">
                {referral.completed_at
                  ? formatDate(referral.completed_at)
                  : referral.qualified_at
                    ? formatDate(referral.qualified_at)
                    : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
