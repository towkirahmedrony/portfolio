import type { Metadata } from "next";
import Link from "next/link";
import { DifyChatbot } from "@/components/ai/dify-chatbot";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Project Assistant",
  description:
    "Ask about websites, web apps, and how to start a project. For a quote or a new build, use Start a Project.",
  path: "/ai-assistant",
});

export default function AiAssistantPage() {
  return (
    <div className="h-dvh overflow-hidden bg-background">
      <section
        className="fixed inset-x-0 top-0 flex min-h-0 w-full flex-col overflow-hidden bg-card"
        style={{ height: "100dvh" }}
        aria-labelledby="ai-assistant-title"
      >
        <header className="flex items-center gap-3 border-b border-card-border bg-card px-3 py-2.5 sm:px-4">
          <Link
            href="/"
            aria-label="Back to the site"
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-card-border bg-background px-3.5 text-xs font-semibold text-foreground transition-colors hover:border-accent/40 hover:text-accent"
          >
            <span aria-hidden>&larr;</span>
            Back
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium tracking-[0.18em] text-accent uppercase">
              Project assistant
            </p>
            <h1
              id="ai-assistant-title"
              className="font-display truncate text-base tracking-tight sm:text-lg"
            >
              Ask about a website or web app
            </h1>
          </div>
        </header>
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 text-center">
          <p className="max-w-sm text-sm leading-6 text-muted">
            The project assistant opens in the chat window. Ask about websites,
            web apps, process, or how to start a project.
          </p>
        </div>
      </section>
      <DifyChatbot />
    </div>
  );
}
