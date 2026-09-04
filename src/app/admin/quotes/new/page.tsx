import Link from "next/link";
import { AdminPage } from "@/components/admin/admin-page";
import { QueryStateNotice } from "@/components/admin/projects/query-state";
import { QuoteEditor } from "@/components/admin/quotes/quote-editor";
import { getQuoteProjectOptions } from "@/lib/admin-quotes";
import { requireAdmin } from "@/lib/require-admin";

export default async function AdminNewQuotePage() {
  await requireAdmin();
  const projects = await getQuoteProjectOptions();

  return (
    <AdminPage
      title="New quote"
      description="Draft a quote against an existing project. Saving creates version 1 or the next unused version."
      className="mx-auto w-full max-w-6xl"
    >
      <Link
        href="/admin/quotes"
        className="mb-6 inline-block text-sm text-muted hover:text-foreground"
      >
        Back to all quotes
      </Link>
      {projects.status === "error" || projects.status === "unavailable" ? (
        <QueryStateNotice result={projects} />
      ) : projects.status === "empty" ? (
        <QueryStateNotice
          result={projects}
          emptyMessage="Create a project before drafting a quote."
        />
      ) : (
        <QuoteEditor projects={projects.data} />
      )}
    </AdminPage>
  );
}
