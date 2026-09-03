"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { CustomerReferral } from "@/types/profile";

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-card-border bg-background px-4 py-4">
      <p className="text-xs font-medium tracking-[0.16em] text-muted uppercase">
        {label}
      </p>
      <p className="mt-2 font-display text-2xl tracking-tight">{value}</p>
    </div>
  );
}

export function ReferralSection({ referral }: { referral: CustomerReferral }) {
  const [copied, setCopied] = useState<"code" | "link" | null>(null);

  async function handleCopy(kind: "code" | "link") {
    const value = kind === "code" ? referral.code : referral.link;
    const ok = await copyText(value);
    if (ok) {
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1800);
    }
  }

  return (
    <Card className="hover:translate-y-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display text-xl tracking-tight">Referrals</h3>
        <Badge>Mock data</Badge>
      </div>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
        Share your code with another client. These figures are sample account
        data and will later come from the database.
      </p>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-card-border bg-background px-4 py-4">
          <p className="text-xs font-medium tracking-[0.16em] text-muted uppercase">
            Referral code
          </p>
          <p className="mt-2 font-display text-2xl tracking-[0.12em]">
            {referral.code}
          </p>
          <Button
            variant="secondary"
            className="mt-4"
            onClick={() => handleCopy("code")}
          >
            {copied === "code" ? "Copied" : "Copy code"}
          </Button>
        </div>

        <div className="rounded-xl border border-card-border bg-background px-4 py-4">
          <p className="text-xs font-medium tracking-[0.16em] text-muted uppercase">
            Referral link
          </p>
          <p className="mt-2 break-all text-sm font-medium">{referral.link}</p>
          <Button
            variant="secondary"
            className="mt-4"
            onClick={() => handleCopy("link")}
          >
            {copied === "link" ? "Copied" : "Copy link"}
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Stat label="Total referrals" value={String(referral.totalReferrals)} />
        <Stat
          label="Qualified referrals"
          value={String(referral.qualifiedReferrals)}
        />
        <Stat
          label="Available reward"
          value={`${referral.availableRewardPercent}% · ${referral.availableRewardStatus}`}
        />
      </div>

      <div className="mt-8">
        <h4 className="text-sm font-medium">Reward status and history</h4>
        <ul className="mt-4 divide-y divide-card-border overflow-hidden rounded-xl border border-card-border">
          {referral.history.map((item) => (
            <li
              key={item.id}
              className="flex flex-col gap-1 bg-background px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-medium">{item.referredName}</p>
                <p className="text-xs text-muted">{item.date}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{item.status}</Badge>
                <span className="text-sm text-muted">{item.rewardPercent}%</span>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-8">
        <h4 className="text-sm font-medium">Referral terms</h4>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-muted">
          {referral.terms.map((term) => (
            <li key={term}>{term}</li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
