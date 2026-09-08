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

  return (
    <>
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
      {/* Invisible for everyone unless an Admin message arrives for the
          signed-in Client — then it shows ONE centered modal. */}
      <ClientMessageNotifier />
    </>
  );
}
