import type { Metadata } from "next";
import { ProjectAssistant } from "@/components/ai/project-assistant";
import { pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Project Assistant",
  description:
    "Ask about websites, web apps, and how to start a project. For a quote or a new build, use Start a Project.",
  path: "/ai-assistant",
});

export default function AiAssistantPage() {
  return (
    <div className="h-dvh overflow-hidden bg-background">
      {/* The header shows only the back icon and Dify's own name/avatar. */}
      <ProjectAssistant variant="page" backHref="/" backLabel="Back" />
    </div>
  );
}
