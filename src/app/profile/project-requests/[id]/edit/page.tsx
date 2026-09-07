import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ProjectRequestForm } from "@/components/project-request/project-request-form";
import { ContentStateMessage } from "@/components/public/content-states";
import { getCustomerProjectRequest } from "@/lib/customer-project-requests";
import { getOrderFormConfig } from "@/lib/order-form-server";
import { projectRequestToFormData } from "@/lib/project-request";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Edit project request",
  description: "Update your project request and resubmit it for review.",
  robots: { index: false, follow: false },
};

export default async function EditProjectRequestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const detail = await getCustomerProjectRequest(user.id, id);
  if (!detail) {
    notFound();
  }

  if (!detail.canEdit) {
    redirect(`/profile/project-requests/${id}`);
  }

  const configResult = await getOrderFormConfig();

  return (
    <div className="mx-auto max-w-3xl pt-28 pb-12 sm:pt-32 px-5 sm:px-8">
      <Link
        href={`/profile/project-requests/${id}`}
        className="mb-8 inline-block text-sm text-muted hover:text-accent"
      >
        &larr; Back to request
      </Link>
      <p className="text-xs font-medium tracking-[0.22em] text-accent uppercase">
        {detail.canResubmit ? "Edit & resubmit" : "Edit request"}
      </p>
      <h1 className="font-display mt-2 text-3xl tracking-tight">
        {detail.request.request_number}
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
        {detail.canResubmit
          ? "Update the brief and resubmit. Your request number stays the same."
          : "Change the details you need. Existing answers stay unless you edit them."}
      </p>

      <div className="mt-10">
        {configResult.status === "ok" ? (
          <ProjectRequestForm
            config={configResult.data}
            serviceId={detail.request.service_id}
            mode="edit"
            requestId={detail.request.id}
            requestNumber={detail.request.request_number}
            resubmit={detail.canResubmit}
            initialData={projectRequestToFormData(detail.request, configResult.data)}
          />
        ) : configResult.status === "empty" ? (
          <ContentStateMessage>
            The project request form is not available yet. Please check back soon.
          </ContentStateMessage>
        ) : (
          <ContentStateMessage>
            The project request form is temporarily unavailable. Please try again
            shortly.
          </ContentStateMessage>
        )}
      </div>
    </div>
  );
}
