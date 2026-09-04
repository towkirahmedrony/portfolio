import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminPage } from "@/components/admin/admin-page";
import { ReferralDetail } from "@/components/admin/referrals/referral-detail";
import { QueryStateNotice } from "@/components/admin/projects/query-state";
import { getAdminReferral } from "@/lib/admin-referrals";
import { personDisplayName } from "@/lib/admin-referral-constants";
import { requireAdmin } from "@/lib/require-admin";

export default async function AdminReferralDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const result = await getAdminReferral(id);

  if (result.status === "empty") {
    notFound();
  }

  if (result.status === "error" || result.status === "unavailable") {
    return (
      <AdminPage
        title="Referral"
        description="Could not load this referral."
        className="mx-auto w-full max-w-6xl"
      >
        <QueryStateNotice result={result} />
      </AdminPage>
    );
  }

  const referral = result.data;

  if (!referral) {
    notFound();
  }

  return (
    <AdminPage
      title={`${personDisplayName(referral.referrer)} → ${referral.referredClient ? personDisplayName(referral.referredClient) : "new client"}`}
      description={`Referral ${referral.code ? `· code ${referral.code}` : ""}`}
      className="mx-auto w-full max-w-6xl"
    >
      <Link
        href="/admin/referrals"
        className="mb-6 inline-block text-sm text-muted hover:text-foreground"
      >
        Back to all referrals
      </Link>
      <ReferralDetail referral={referral} />
    </AdminPage>
  );
}
