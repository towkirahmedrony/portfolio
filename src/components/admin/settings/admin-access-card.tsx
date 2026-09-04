import type { ReactNode } from "react";
import type { QueryResult } from "@/lib/admin-project-constants";
import type {
  AdminAccountListItem,
} from "@/lib/admin-settings";
import type { AdminSessionUser } from "@/types/admin";

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <dt className="text-muted">{label}</dt>
      <dd className="break-all text-right text-foreground">{value}</dd>
    </div>
  );
}

export function AdminAccessCard({
  session,
  accountsResult,
}: {
  session: AdminSessionUser;
  accountsResult: QueryResult<AdminAccountListItem[]>;
}) {
  return (
    <section className="mx-auto w-full max-w-3xl rounded-3xl border border-card-border bg-card p-6">
      <h3 className="font-display text-lg text-foreground">Admin &amp; access</h3>
      <p className="mt-1 text-sm text-muted">
        Your signed-in admin identity. Multi-admin management is not
        implemented yet — nothing here can change roles.
      </p>

      <dl className="mt-5 text-sm">
        <Row label="Name" value={session.displayName || "—"} />
        <Row label="Email" value={session.email || "—"} />
        <Row label="Role" value={session.role} />
      </dl>

      <div className="mt-5">
        <p className="mb-1 text-xs font-medium uppercase tracking-[0.18em] text-muted">
          Active admins
        </p>
        {accountsResult.status === "ok" || accountsResult.status === "empty" ? (
          accountsResult.data.length > 0 ? (
            <ul className="divide-y divide-card-border/60">
              {accountsResult.data.map((account) => (
                <li
                  key={account.id}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <span className="text-sm text-foreground">{account.name}</span>
                  {account.isCurrent ? (
                    <span className="rounded-full border border-card-border px-2 py-0.5 text-xs text-muted">
                      you
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl bg-background px-3 py-2 text-xs text-muted">
              No other active admins found.
            </p>
          )
        ) : (
          <p className="rounded-xl bg-background px-3 py-2 text-xs text-muted">
            {accountsResult.status === "unavailable"
              ? "The admin directory is unavailable right now."
              : `Could not load admins. ${accountsResult.message}`}
          </p>
        )}
      </div>

      <div className="mt-5 rounded-2xl border border-dashed border-card-border bg-background p-4">
        <p className="text-sm font-medium text-foreground">Future extension</p>
        <p className="mt-1 text-xs leading-5 text-muted">
          Role management (inviting/removing admins, changing roles) is
          intentionally not exposed yet for safety. When it is added, this
          section renders from the same profiles table — no schema change is
          needed to list admins, only for invite tokens/audit of role changes.
        </p>
      </div>
    </section>
  );
}
