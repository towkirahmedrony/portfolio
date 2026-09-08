import { Suspense } from "react";
import { AdminPage } from "@/components/admin/admin-page";
import { ContentListSkeleton } from "@/components/admin/content/content-skeletons";
import { RequestFormBuilder } from "@/components/admin/request-form/request-form-builder";
import { QueryStateNotice } from "@/components/admin/projects/query-state";
import { getAdminOrderFormTree } from "@/lib/admin-order-form";
import { requireAdmin } from "@/lib/require-admin";

async function RequestFormContent() {
  const result = await getAdminOrderFormTree();

  if (result.status === "error" || result.status === "unavailable") {
    return <QueryStateNotice result={result} />;
  }

  return <RequestFormBuilder tree={result.data} />;
}

export default async function AdminRequestFormPage() {
  await requireAdmin();

  return (
    <AdminPage
      title="Project Request Form"
      description="Manage the public /start-project form: steps, fields and options. Changes apply to new submissions only. Existing requests keep their stored snapshots."
      className="mx-auto w-full max-w-6xl"
    >
      <Suspense fallback={<ContentListSkeleton />}>
        <RequestFormContent />
      </Suspense>
    </AdminPage>
  );
}
