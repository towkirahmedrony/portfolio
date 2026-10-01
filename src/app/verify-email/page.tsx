import type { Metadata } from "next";
import { VerifyEmailPanel } from "@/components/auth/verify-email";
import { PageHero } from "@/components/ui/section";
import {
  getPathnameFromNext,
  isPlaceOrderAuthReason,
  isValidEmail,
  resolvePostAuthRedirect,
} from "@/lib/auth";

export const metadata: Metadata = {
  title: "Verify your email",
  description: "Check your inbox and verify your email address.",
  robots: {
    index: false,
    follow: false,
  },
};

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{
    email?: string | string[];
    next?: string | string[];
    reason?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const rawEmail = first(params.email);
  const reason = first(params.reason);
  // `resolvePostAuthRedirect` runs the destination through `getSafeNextPath`,
  // so only internal, allow-listed routes can ever be used here.
  const destination = resolvePostAuthRedirect({
    next: first(params.next),
    reason,
  });
  const placeOrder =
    isPlaceOrderAuthReason(reason) ||
    getPathnameFromNext(destination) === "/start-project";

  return (
    <>
      <PageHero
        eyebrow="Almost there"
        title="Check your email"
        description="A verification link is on its way. Open it to confirm your account and continue where you left off."
      />
      <section className="py-12 sm:py-16">
        <div className="mx-auto w-full max-w-md px-5 sm:px-8">
          <VerifyEmailPanel
            email={isValidEmail(rawEmail) ? rawEmail.trim() : ""}
            nextPath={destination}
            placeOrder={placeOrder}
          />
        </div>
      </section>
    </>
  );
}
