"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatReferralPercent } from "@/lib/profile";
import type { CustomerReferral } from "@/types/profile";

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

/** Display labels only — no referral percentage or amount is defined here. */
const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  qualified: "Qualified",
  reward_pending: "Reward pending",
  reward_available: "Reward available",
  completed: "Completed",
  cancelled: "Cancelled",
  invalid: "Invalid",
};

const REWARD_LABELS: Record<string, string> = {
  pending: "Reward pending",
  available: "Reward available",
  redeemed: "Reward redeemed",
  expired: "Reward expired",
  cancelled: "Reward cancelled",
};

function statusLabel(value: string): string {
  return STATUS_LABELS[value] ?? value.replace(/_/g, " ");
}

function rewardLabel(value: string): string {
  return REWARD_LABELS[value] ?? value.replace(/_/g, " ");
}

function formatExpiry(value: string | null): string {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function Stat({ label, value }: { label: string; value: string }) {
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
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [shareNote, setShareNote] = useState<string | null>(null);

  const canShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  const discountSuffix =
    referral.clientDiscountPercent > 0
      ? ` and get ${formatReferralPercent(referral.clientDiscountPercent)}% off your first project`
      : "";

  async function handleCopy(kind: "code" | "link") {
    const value = kind === "code" ? referral.code : referral.link;
    if (!value) {
      return;
    }
    const ok = await copyText(value);
    if (ok) {
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1800);
    }
  }

  async function handleShare() {
    if (!referral.link) {
      return;
    }

    setShareNote(null);

    try {
      await navigator.share({
        title: "Referral invitation",
        text: `Use my referral code ${referral.code}${discountSuffix}.`,
        url: referral.link,
      });
      return;
    } catch {
      // User dismissed the sheet, or the browser refused: fall back to copying.
    }

    const ok = await copyText(referral.link);
    setShareNote(
      ok ? "Sharing is unavailable here — link copied instead." : "Could not share the link.",
    );
    window.setTimeout(() => setShareNote(null), 3000);
  }

  const referred = referral.referredBy;

  return (
    <Card className="hover:translate-y-0 transition-all">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsOpen((prev) => !prev);
          }
        }}
        className="flex cursor-pointer select-none items-center justify-between gap-3"
      >
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="font-display text-xl tracking-tight">Referrals</h3>
          <Badge>
            {referral.code
              ? referral.codeActive
                ? "Your code"
                : "Inactive"
              : "Unavailable"}
          </Badge>
          {!referral.programActive ? <Badge>Programme paused</Badge> : null}
          {referred ? <Badge>You were referred</Badge> : null}
        </div>

        <div className="flex items-center gap-2 text-sm text-muted">
          <span>{isOpen ? "Hide details" : "View details"}</span>
          <svg
            className={`h-4 w-4 transform transition-transform duration-200 ${
              isOpen ? "rotate-180" : ""
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </div>

      {isOpen && (
        <div className="mt-4 border-t border-card-border pt-4 animate-in fade-in duration-200">
          <p className="max-w-2xl text-sm leading-6 text-muted">
            Share your referral code with another client. When a referred client
            starts their first project, the referral and any reward are tracked
            here from your account data.
          </p>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-card-border bg-background px-4 py-4">
              <p className="text-xs font-medium tracking-[0.16em] text-muted uppercase">
                Referral code
              </p>
              <p className="mt-2 font-display text-2xl tracking-[0.12em]">
                {referral.code || "—"}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  onClick={() => handleCopy("code")}
                  disabled={!referral.code || !referral.codeActive}
                >
                  {copied === "code" ? "Copied" : "Copy code"}
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-card-border bg-background px-4 py-4">
              <p className="text-xs font-medium tracking-[0.16em] text-muted uppercase">
                Your referral link
              </p>
              <p className="mt-2 break-all text-sm font-medium">
                {referral.link || "Not provided"}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  onClick={() => handleCopy("link")}
                  disabled={!referral.link || !referral.codeActive}
                >
                  {copied === "link" ? "Copied" : "Copy link"}
                </Button>
                {canShare ? (
                  <Button
                    variant="secondary"
                    onClick={handleShare}
                    disabled={!referral.link || !referral.codeActive}
                  >
                    Share
                  </Button>
                ) : null}
              </div>
              {shareNote ? (
                <p className="mt-3 text-xs text-muted" role="status">
                  {shareNote}
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Total referrals"
              value={String(referral.totalReferrals)}
            />
            <Stat
              label="Qualified referrals"
              value={String(referral.qualifiedReferrals)}
            />
            <Stat
              label="Available rewards"
              value={
                referral.availableRewardPercent > 0
                  ? `${formatReferralPercent(referral.availableRewardPercent)}%`
                  : "None"
              }
            />
            <Stat
              label="Total earned"
              value={
                referral.totalEarnedRewardPercent > 0
                  ? `${formatReferralPercent(referral.totalEarnedRewardPercent)}%`
                  : "None"
              }
            />
          </div>

          <p className="mt-3 text-xs text-muted">
            Reward amounts are settled against the qualifying project by the
            team; this view shows the percentages stored on each referral.
          </p>

          <div className="mt-8">
            <h4 className="text-sm font-medium">Reward status and history</h4>
            {referral.history.length > 0 ? (
              <ul className="mt-4 divide-y divide-card-border overflow-hidden rounded-xl border border-card-border">
                {referral.history.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-col gap-1 bg-background px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      {item.referredName ? (
                        <p className="text-sm font-medium">{item.referredName}</p>
                      ) : (
                        <p className="text-sm font-medium text-muted">
                          Referred client
                        </p>
                      )}
                      <p className="text-xs text-muted">{item.date}</p>
                      <p className="mt-1 text-xs text-muted">
                        {item.firstProjectLinked
                          ? "First project linked"
                          : "No project linked yet"}
                        {item.rewardExpiresAt
                          ? ` · expires ${formatExpiry(item.rewardExpiresAt)}`
                          : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge>{statusLabel(item.status)}</Badge>
                      <span className="text-sm text-muted">
                        {formatReferralPercent(item.rewardPercent)}% reward
                      </span>
                      <span className="text-xs text-muted">
                        {formatReferralPercent(item.clientDiscountPercent)}%
                        client discount
                      </span>
                      {item.rewardStatus ? (
                        <Badge>{rewardLabel(item.rewardStatus)}</Badge>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 rounded-xl border border-card-border bg-background px-4 py-4 text-sm text-muted">
                No referrals yet. Share your code with a new client to start
                tracking.
              </p>
            )}
          </div>

          {referred ? (
            <div className="mt-8">
              <h4 className="text-sm font-medium">Your referral</h4>
              <div className="mt-4 rounded-xl border border-card-border bg-background px-4 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{statusLabel(referred.status)}</Badge>
                  <span className="text-sm text-muted">
                    {formatReferralPercent(referred.clientDiscountPercent)}% off
                    your first project
                  </span>
                </div>
                <p className="mt-2 text-xs text-muted">
                  Referred on {referred.date}.{" "}
                  {referred.firstProjectLinked
                    ? "Your first project is linked to this referral."
                    : referred.requestLinked
                      ? "Your project request is linked to this referral."
                      : "Submit your first project request to use it."}
                </p>
              </div>
            </div>
          ) : null}

          <div className="mt-8">
            <h4 className="text-sm font-medium">Referral terms</h4>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-muted">
              {referral.terms.map((term) => (
                <li key={term}>{term}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Card>
  );
}
