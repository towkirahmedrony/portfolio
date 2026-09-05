import type { ProfileRole, ProfileStatus } from "@/types/database";

export type AdminAccessProfile = {
  full_name: string;
  display_name: string | null;
  role: ProfileRole;
  status: ProfileStatus;
};

export type AdminAccessDecision = "unauthenticated" | "forbidden" | "allow";

export function decideAdminAccess({
  hasUser,
  isAdminRpc,
  rpcError,
  profile,
}: {
  hasUser: boolean;
  isAdminRpc: boolean | null;
  rpcError: boolean;
  profile: AdminAccessProfile | null;
}): AdminAccessDecision {
  if (!hasUser) {
    return "unauthenticated";
  }

  if (!rpcError && isAdminRpc === true) {
    return "allow";
  }

  if (
    rpcError &&
    profile &&
    profile.role === "admin" &&
    profile.status === "active"
  ) {
    return "allow";
  }

  return "forbidden";
}
