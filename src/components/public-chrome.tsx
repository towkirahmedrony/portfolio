"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AiAssistantFab } from "@/components/ai/ai-assistant-fab";
import { ClientMessageNotifier } from "@/components/client-notifications/client-message-notifier";
import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";

export function PublicChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isAdminRoute = pathname.startsWith("/admin");

  if (isAdminRoute) {
    const isAdminChatRoute =
      /^\/admin\/(?:projects\/[^/]+\/messages|project-requests\/[^/]+\/messages)$/.test(
        pathname,
      );
    return (
      <div
        className={
          isAdminChatRoute
            ? "flex min-h-0 flex-1 flex-col overflow-hidden"
            : "flex-1"
        }
      >
        {children}
      </div>
    );
  }

  // Chat routes behave like a dedicated messaging screen: the portfolio
  // footer is hidden so the conversation owns the full viewport height.
  const isChatRoute =
    /^\/profile\/(?:projects\/[^/]+\/messages|project-requests\/[^/]+\/messages)$/.test(
      pathname,
    );
  const isAiAssistantRoute = pathname === "/ai-assistant";

  if (isAiAssistantRoute) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>
    );
  }

  return (
    <>
      <Navbar />
      <main className="flex-1">{children}</main>
      {!isChatRoute ? <Footer /> : null}
      <AiAssistantFab />
      {/* Invisible for everyone unless an Admin message arrives for the
          signed-in Client — then it shows ONE centered modal. */}
      <ClientMessageNotifier />
    </>
  );
}
