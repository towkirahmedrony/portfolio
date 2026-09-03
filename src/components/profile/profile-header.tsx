import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { CustomerProfile, ProfileRole } from "@/types/profile";

export function getProfileInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function ProfileAvatar({
  fullName,
  avatarUrl,
  size = "lg",
}: {
  fullName: string;
  avatarUrl: string;
  size?: "md" | "lg";
}) {
  const initials = getProfileInitials(fullName) || "?";
  const dimension = size === "lg" ? "h-24 w-24 sm:h-28 sm:w-28" : "h-16 w-16";
  const isRemote =
    avatarUrl.startsWith("http://") || avatarUrl.startsWith("https://");

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-full border border-card-border bg-accent-soft",
        dimension,
      )}
    >
      {avatarUrl ? (
        isRemote ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={`${fullName} profile photo`}
            className="h-full w-full object-cover"
          />
        ) : (
          <Image
            src={avatarUrl}
            alt={`${fullName} profile photo`}
            fill
            className="object-cover"
            sizes={size === "lg" ? "112px" : "64px"}
          />
        )
      ) : (
        <span className="flex h-full w-full items-center justify-center font-display text-2xl tracking-tight text-accent sm:text-3xl">
          {initials}
        </span>
      )}
    </div>
  );
}

function roleLabel(role: ProfileRole): string {
  return role === "admin" ? "Admin" : "Customer";
}

export function ProfileHeader({
  profile,
  role,
  editing,
  status,
  saveError,
  onEdit,
}: {
  profile: CustomerProfile;
  role: ProfileRole;
  editing: boolean;
  status: "idle" | "saved" | "cancelled";
  saveError?: string | null;
  onEdit: () => void;
}) {
  const subtitle =
    profile.displayName || profile.jobTitle || profile.companyName;

  return (
    <Card className="hover:translate-y-0">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4 sm:gap-5">
          <ProfileAvatar
            fullName={profile.fullName}
            avatarUrl={profile.avatarUrl}
          />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-medium tracking-[0.22em] text-accent uppercase">
                Customer profile
              </p>
              <Badge>{roleLabel(role)}</Badge>
            </div>
            <h2 className="font-display mt-2 text-2xl tracking-tight sm:text-3xl">
              {profile.fullName || "Not provided"}
            </h2>
            {subtitle ? (
              <p className="mt-1 text-sm text-muted">{subtitle}</p>
            ) : null}
          </div>
        </div>

        {editing ? null : (
          <Button onClick={onEdit} className="w-full sm:w-auto">
            Edit Profile
          </Button>
        )}
      </div>

      {saveError ? (
        <p className="mt-6 text-sm text-accent" role="alert">
          {saveError}
        </p>
      ) : null}
      {status === "saved" && !editing && !saveError ? (
        <p className="mt-6 text-sm text-accent" role="status">
          Profile saved.
        </p>
      ) : null}
      {status === "cancelled" && !editing && !saveError ? (
        <p className="mt-6 text-sm text-muted" role="status">
          Changes discarded.
        </p>
      ) : null}
    </Card>
  );
}
