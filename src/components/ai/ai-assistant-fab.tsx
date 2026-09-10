"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AssistantIcon } from "@/components/ai/assistant-icon";

const HIDDEN_PREFIXES = ["/admin", "/ai-assistant"];
const HIDDEN_CHAT =
  /^\/profile\/(?:projects\/[^/]+\/messages|project-requests\/[^/]+\/messages)$/;

export function AiAssistantFab() {
  const pathname = usePathname();

  if (
    HIDDEN_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)) ||
    HIDDEN_CHAT.test(pathname)
  ) {
    return null;
  }

  return (
    <Link
      href="/ai-assistant"
      aria-label="Open project assistant"
      className="fixed right-4 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-40 inline-flex h-12 w-12 items-center justify-center rounded-full border border-card-border bg-card text-accent shadow-[0_8px_24px_rgba(20,20,20,0.12)] transition-colors hover:border-accent/40 hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:right-6 sm:h-12 sm:w-12"
    >
      <AssistantIcon />
      <span className="sr-only">Ask the project assistant</span>
    </Link>
  );
}
