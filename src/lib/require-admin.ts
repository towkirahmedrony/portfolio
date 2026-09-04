import { redirect } from "next/navigation";
import { isAdminRole } from "@/lib/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { AdminSessionUser } from "@/types/admin";

export async function requireAdmin(): Promise<AdminSessionUser> {
  if (!isSupabaseConfigured()) {
    redirect("/login?next=/admin");
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/admin");
  }

  try {
    await supabase.rpc("sync_customer_session");
  } catch {
    // Session is already established; profile sync retries on the next request.
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, display_name, role, status")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !isAdminRole(profile.role) || profile.status !== "active") {
    redirect("/profile");
  }

  return {
    id: user.id,
    email: user.email ?? "",
    displayName: profile.display_name || profile.full_name,
    role: profile.role,
  };
}
