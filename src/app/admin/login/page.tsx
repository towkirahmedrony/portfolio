import type { Metadata } from "next";
import Link from "next/link";
import { AdminLoginForm } from "@/components/admin/admin-login-form";
import { ThemeToggle } from "@/components/theme-toggle";
import { site } from "@/data/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin login",
  description: "Sign in to the admin dashboard with email and password.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminLoginPage() {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="flex h-16 items-center justify-between px-5 sm:px-8">
        <Link href="/" className="font-display text-[0.95rem] tracking-tight">
          {site.name}
        </Link>
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-center justify-center px-5 py-12 sm:px-8 sm:py-16">
        <div className="w-full max-w-md">
          <p className="mb-3 text-xs font-medium tracking-[0.22em] text-accent uppercase">
            Admin only
          </p>
          <h1 className="font-display text-4xl leading-tight tracking-tight text-balance sm:text-5xl">
            Admin sign in
          </h1>
          <p className="mt-4 text-base leading-7 text-muted">
            Email and password only. Customer accounts, Google, and GitHub cannot
            access this dashboard.
          </p>
          <div className="mt-8">
            <AdminLoginForm />
          </div>
        </div>
      </main>
    </div>
  );
}
