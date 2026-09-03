import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { CustomerAccount } from "@/types/profile";

function AccountRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="grid gap-1 border-t border-card-border pt-4 first:border-t-0 first:pt-0">
      <dt className="text-xs font-medium tracking-[0.16em] text-muted uppercase">
        {label}
      </dt>
      <dd className="text-sm font-medium sm:text-base">{value}</dd>
    </div>
  );
}

function roleLabel(role: CustomerAccount["role"]): string {
  return role === "client" ? "Customer" : "Admin";
}

function statusLabel(status: CustomerAccount["status"]): string {
  if (status === "active") {
    return "Active";
  }
  if (status === "suspended") {
    return "Suspended";
  }
  return "Deleted";
}

export function AccountInfo({ account }: { account: CustomerAccount }) {
  return (
    <Card className="hover:translate-y-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display text-xl tracking-tight">Account</h3>
        <Badge>Read-only</Badge>
      </div>
      <p className="mt-2 text-sm leading-6 text-muted">
        System fields for this customer account. These cannot be edited here.
      </p>

      <dl className="mt-6 grid gap-4">
        <AccountRow label="Account Role" value={roleLabel(account.role)} />
        <AccountRow label="Account Status" value={statusLabel(account.status)} />
        <AccountRow
          label="Email Verification"
          value={account.emailVerified ? "Verified" : "Unverified"}
        />
        <AccountRow label="Member Since" value={account.memberSince} />
        <AccountRow label="Last Active" value={account.lastActive} />
      </dl>
    </Card>
  );
}
