import Link from "next/link";
import type { ReactNode } from "react";
import { AdminPanel, StatusPill } from "@/components/admin/projects/query-state";
import {
  formatDate,
  formatDateTime,
  formatPercentLabel,
  formatReferralStatusLabel,
  formatRewardStatusLabel,
  getReferralStatusStyle,
  getRewardStatusStyle,
  personDisplayName,
  type AdminReferralDetail,
  type AdminReferralRewardItem,
} from "@/lib/admin-referral-constants";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="text-foreground">{children}</dd>
    </div>
  );
}

function ProfileLink({
  href,
  name,
  company,
}: {
  href: string;
  name: string;
  company?: string | null;
}) {
  return (
    <div>
      <Link href={href} className="font-medium text-foreground hover:underline">
        {name}
      </Link>
      {company ? <div className="text-xs text-muted">{company}</div> : null}
    </div>
  );
}

function RewardRow({ reward }: { reward: AdminReferralRewardItem }) {
  return (
    <li className="flex items-center justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">
          {reward.reward_type.replace(/_/g, " ")} · {formatPercentLabel(reward.reward_percent)}
        </p>
        <p className="mt-0.5 text-xs text-muted">
          Created {formatDate(reward.created_at)}
          {reward.available_from ? ` · available ${formatDate(reward.available_from)}` : ""}
          {reward.expires_at ? ` · expires ${formatDate(reward.expires_at)}` : ""}
          {reward.redeemed_at ? ` · redeemed ${formatDateTime(reward.redeemed_at)}` : ""}
          {reward.redeemedProjectNumber
            ? ` · project ${reward.redeemedProjectNumber}`
            : ""}
        </p>
      </div>
      <StatusPill
        label={formatRewardStatusLabel(reward.status)}
        className={getRewardStatusStyle(reward.status)}
      />
    </li>
  );
}

export function ReferralDetail({ referral }: { referral: AdminReferralDetail }) {
  const { rewards } = referral;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill
          label={formatReferralStatusLabel(referral.status)}
          className={getReferralStatusStyle(referral.status)}
        />
        <span className="text-sm text-muted">
          Created {formatDateTime(referral.created_at)}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <AdminPanel
          title="Relationship"
          description="People, code and pipeline references for this referral."
        >
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <Field label="Referrer">
              <ProfileLink
                href={`/admin/clients/${referral.referrer_id}`}
                name={personDisplayName(referral.referrer)}
                company={referral.referrer?.company_name}
              />
            </Field>
            <Field label="Referred client">
              {referral.referredClient ? (
                <ProfileLink
                  href={`/admin/clients/${referral.referred_client_id}`}
                  name={personDisplayName(referral.referredClient)}
                  company={referral.referredClient.company_name}
                />
              ) : (
                "No client yet (waiting for signup)"
              )}
            </Field>
            <Field label="Referral code">
              {referral.code ? (
                <span className="font-mono text-sm">{referral.code}</span>
              ) : (
                "—"
              )}
            </Field>
            <Field label="Related project">
              {referral.first_project_id ? (
                <Link
                  href={`/admin/projects/${referral.first_project_id}`}
                  className="font-medium text-foreground hover:underline"
                >
                  {referral.projectNumber}
                </Link>
              ) : (
                "—"
              )}
            </Field>
            <Field label="Project request">
              {referral.project_request_id ? (
                <Link
                  href={`/admin/project-requests/${referral.project_request_id}`}
                  className="font-medium text-foreground hover:underline"
                >
                  {referral.requestNumber}
                </Link>
              ) : (
                "—"
              )}
            </Field>
            <Field label="Qualified at">{formatDateTime(referral.qualified_at)}</Field>
            <Field label="Completed at">{formatDateTime(referral.completed_at)}</Field>
            <Field label="Cancelled at">{formatDateTime(referral.cancelled_at)}</Field>
          </dl>
        </AdminPanel>

        <AdminPanel
          title="Program terms"
          description="Percentages applied when this referral was created."
        >
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <Field label="Client discount">
              {formatPercentLabel(referral.client_discount_percent)}
            </Field>
            <Field label="Referrer reward">
              {formatPercentLabel(referral.referrer_reward_percent)}
            </Field>
          </dl>
        </AdminPanel>
      </div>

      <AdminPanel
        title="Reward history"
        description="Rewards linked to this referral. Reward state is managed by the referral lifecycle — it is shown here read-only."
      >
        {rewards.status === "ok" || rewards.status === "empty" ? (
          rewards.data.length > 0 ? (
            <ul className="divide-y divide-card-border/60">
              {rewards.data.map((reward) => (
                <RewardRow key={reward.id} reward={reward} />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No rewards have been issued for this referral.</p>
          )
        ) : (
          <p className="rounded-xl bg-background px-3 py-2 text-xs text-muted">
            {rewards.status === "unavailable"
              ? "referral_rewards is not available in the current database schema."
              : `Could not load reward history. ${rewards.message}`}
          </p>
        )}
      </AdminPanel>
    </div>
  );
}
