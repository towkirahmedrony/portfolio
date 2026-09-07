import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ProjectRequestDetails } from "@/components/profile/project-request-details";
import { getCustomerProjectRequest } from "@/lib/customer-project-requests";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Project request details",
  description: "View the full details of your submitted project request.",
  robots: { index: false, follow: false },
};

export default async function ProjectRequestDetailsPage({
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

  return <ProjectRequestDetails detail={detail} />;
}
