import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { PageHero } from "@/components/ui/section";

export const metadata: Metadata = {
  title: "Log in",
  description: "Log in to view and update your customer profile.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function LoginPage() {
  return (
    <>
      <PageHero
        eyebrow="Account"
        title="Log in"
        description="Sign in with your email to access your customer profile."
      />
      <section className="py-12 sm:py-16">
        <div className="mx-auto w-full max-w-md px-5 sm:px-8">
          <LoginForm />
        </div>
      </section>
    </>
  );
}
