import type { Metadata } from "next";
import { CustomerProfile } from "@/components/profile/customer-profile";
import { PageHero } from "@/components/ui/section";

export const metadata: Metadata = {
  title: "Customer Profile",
  description: "View and update your customer profile, account details, and referral information.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ProfilePage() {
  return (
    <>
      <PageHero
        eyebrow="Customer"
        title="Your profile"
        description="Review your customer details and account information from your profile. Referral figures remain sample data until that backend is connected."
      />
      <section className="py-12 sm:py-16">
        <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
          <CustomerProfile />
        </div>
      </section>
    </>
  );
}
