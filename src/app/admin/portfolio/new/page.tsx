import Link from "next/link";
import { AdminPage } from "@/components/admin/admin-page";
import { PortfolioProjectForm } from "@/components/admin/content/portfolio-form";
import { requireAdmin } from "@/lib/require-admin";

export default async function AdminPortfolioNewPage() {
  await requireAdmin();

  return (
    <AdminPage
      title="Add portfolio project"
      description="Create a new portfolio project. Slug, URLs and the published/featured state are validated on save."
      className="mx-auto w-full max-w-6xl"
    >
      <Link
        href="/admin/portfolio"
        className="mb-6 inline-block text-sm text-muted hover:text-foreground"
      >
        Back to portfolio
      </Link>
      <PortfolioProjectForm isNew project={null} />
    </AdminPage>
  );
}
