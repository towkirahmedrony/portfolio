import type { ReactNode } from "react";
import type { QueryResult } from "@/lib/admin-referral-constants";

function Metric({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string | number;
  valueClass?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-sm text-muted">{label}</span>
      <span className={`font-display text-xl text-foreground ${valueClass ?? ""}`}>
        {value}
      </span>
    </div>
  );
}

function OverviewGroup({
  title,
  result,
  blockedTable,
  children,
}: {
  title: string;
  result: QueryResult<unknown>;
  blockedTable: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-card-border bg-card p-5">
      <h3 className="font-display mb-3 text-lg text-foreground">{title}</h3>
      {result.status === "ok" ? (
        <div className="grid gap-2.5">{children}</div>
      ) : (
        <p className="rounded-xl bg-background px-3 py-2 text-xs text-muted">
          {result.status === "error"
            ? `Could not load this data. ${result.message}`
            : `${blockedTable} is not available in the current database schema.`}
        </p>
      )}
    </section>
  );
}

export function ReferralOverview({
  overview,
}: {
  overview: {
    codes: QueryResult<{ total: number; active: number }>;
    referrals: QueryResult<{ total: number; qualified: number }>;
    rewards: QueryResult<{ pending: number; available: number; redeemed: number }>;
  };
}) {
  const codes = overview.codes.status === "ok" ? overview.codes.data : null;
  const referrals = overview.referrals.status === "ok" ? overview.referrals.data : null;
  const rewards = overview.rewards.status === "ok" ? overview.rewards.data : null;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <OverviewGroup
        title="Referral codes"
        result={overview.codes}
        blockedTable="referral_codes"
      >
        <Metric label="Total codes" value={codes?.total ?? 0} />
        <Metric label="Active codes" value={codes?.active ?? 0} />
      </OverviewGroup>

      <OverviewGroup title="Referrals" result={overview.referrals} blockedTable="referrals">
        <Metric label="Total referrals" value={referrals?.total ?? 0} />
        <Metric label="Qualified referrals" value={referrals?.qualified ?? 0} />
      </OverviewGroup>

      <OverviewGroup
        title="Rewards"
        result={overview.rewards}
        blockedTable="referral_rewards"
      >
        <Metric label="Pending rewards" value={rewards?.pending ?? 0} />
        <Metric
          label="Available rewards"
          value={rewards?.available ?? 0}
          valueClass="text-emerald-600 dark:text-emerald-400"
        />
        <Metric label="Redeemed rewards" value={rewards?.redeemed ?? 0} />
      </OverviewGroup>
    </div>
  );
}
