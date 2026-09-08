"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ClientMessageNotifier } from "@/components/client-notifications/client-message-notifier";
import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";

export function PublicChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isAdminRoute = pathname.startsWith("/admin");

  if (isAdminRoute) {
    return <div className="flex-1">{children}</div>;
  }

  // Chat routes behave like a dedicated messaging screen: the portfolio
  // footer is hidden so the conversation owns the full viewport height.
  const isChatRoute =
    /^\/profile\/(?:projects\/[^/]+\/messages|project-requests\/[^/]+\/messages)$/.test(
      pathname,
    );

  return (
    <>
      <Navbar />
      <main className="flex-1">{children}</main>
      {!isChatRoute ? <Footer /> : null}
      {/* Invisible for everyone unless an Admin message arrives for the
          signed-in Client — then it shows ONE centered modal. */}
      <ClientMessageNotifier />
    </>
  );
}
