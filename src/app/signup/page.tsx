import type { Metadata } from "next";
import { SignupForm } from "@/components/auth/signup-form";
import { PageHero } from "@/components/ui/section";

export const metadata: Metadata = {
  title: "Sign up",
  description: "Create a customer account to access your profile.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function SignupPage() {
  return (
    <>
      <PageHero
        eyebrow="Account"
        title="Create an account"
        description="Sign up with email, Google, or GitHub to start using your customer profile."
      />
      <section className="py-12 sm:py-16">
        <div className="mx-auto w-full max-w-md px-5 sm:px-8">
          <SignupForm />
        </div>
      </section>
    </>
  );
}
