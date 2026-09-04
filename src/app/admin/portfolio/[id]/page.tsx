import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminPage } from "@/components/admin/admin-page";
import { PortfolioImagesManager } from "@/components/admin/content/portfolio-images-manager";
import { PortfolioProjectForm } from "@/components/admin/content/portfolio-form";
import { QueryStateNotice } from "@/components/admin/projects/query-state";
import { getAdminPortfolioProject } from "@/lib/admin-content";
import { requireAdmin } from "@/lib/require-admin";

export default async function AdminPortfolioProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const result = await getAdminPortfolioProject(id);

  if (result.status === "empty") {
    notFound();
  }

  if (result.status === "error" || result.status === "unavailable") {
    return (
      <AdminPage
        title="Portfolio project"
        description="Could not load this project."
        className="mx-auto w-full max-w-6xl"
      >
        <QueryStateNotice result={result} />
      </AdminPage>
    );
  }

  const project = result.data;

  if (!project) {
    notFound();
  }

  return (
    <AdminPage
      title={project.title}
      description={`Slug: ${project.slug}`}
      className="mx-auto w-full max-w-6xl"
    >
      <Link
        href="/admin/portfolio"
        className="mb-6 inline-block text-sm text-muted hover:text-foreground"
      >
        Back to portfolio
      </Link>
      <div className="space-y-6">
        <PortfolioProjectForm project={project} isNew={false} />
        <PortfolioImagesManager projectId={project.id} images={project.images} />
      </div>
    </AdminPage>
  );
}
