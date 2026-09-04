import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { decideAdminAccess } from "@/lib/admin-access";
import { getLoginRedirectPath, isAdminPath } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { AdminSessionUser } from "@/types/admin";

async function getRequestedAdminPath(): Promise<string> {
  try {
    const headerStore = await headers();
    const pathname = headerStore.get("x-pathname");
    if (pathname && isAdminPath(pathname)) {
      return pathname;
    }
  } catch {
    // headers() is unavailable outside a request scope.
  }

  return "/admin";
}

export async function requireAdmin(): Promise<AdminSessionUser> {
  if (!isSupabaseConfigured()) {
    redirect(getLoginRedirectPath(await getRequestedAdminPath()));
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(getLoginRedirectPath(await getRequestedAdminPath()));
  }

  try {
    await supabase.rpc("sync_customer_session");
  } catch {
    // Session is already established; profile sync retries on the next request.
  }

  const { data: isAdmin, error: adminCheckError } = await supabase.rpc(
    "is_active_admin",
  );

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, display_name, role, status")
    .eq("id", user.id)
    .maybeSingle();

  const decision = decideAdminAccess({
    hasUser: true,
    isAdminRpc: isAdmin ?? null,
    rpcError: Boolean(adminCheckError),
    profile,
  });

  if (decision !== "allow") {
    redirect("/profile");
  }

  return {
    id: user.id,
    email: user.email ?? "",
    displayName: profile?.display_name || profile?.full_name || user.email || "Admin",
    role: "admin",
  };
}
