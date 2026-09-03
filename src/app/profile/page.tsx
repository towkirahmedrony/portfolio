import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { CustomerProfile } from "@/components/profile/customer-profile";
import { PageHero } from "@/components/ui/section";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { mapProfileRow, mapReferralCode } from "@/lib/profile";

export const metadata: Metadata = {
  title: "Customer Profile",
  description: "View and update your customer profile, account details, and referral information.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function ProfilePage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Session sync (optional but safe to keep)
  await supabase.rpc("sync_customer_session").catch(() => {});

  // Fetch Profile Data directly on the server
  const { data: profileData } = await supabase
    .from("profiles")
    .select("id, full_name, display_name, avatar_url, phone, company_name, job_title, role, status, email_verified, created_at, updated_at, last_seen_at")
    .eq("id", user.id)
    .maybeSingle();

  // Fetch Referral Data directly on the server
  const { data: referralRow } = await supabase
    .from("referral_codes")
    .select("code")
    .eq("owner_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  // Map Data
  const mapped = mapProfileRow(profileData || { id: user.id }, user.email ?? "");
  const referral = mapReferralCode(referralRow?.code ?? null);

  return (
    <>
      <PageHero
        eyebrow="Customer"
        title="Your profile"
        description="Review your customer details and account information from your profile. Referral rewards remain unconnected until that backend is available."
      />
      <section className="py-12 sm:py-16">
        <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
          <CustomerProfile 
            initialProfile={mapped.profile} 
            initialAccount={mapped.account} 
            initialReferral={referral} 
          />
        </div>
      </section>
    </>
  );
}
