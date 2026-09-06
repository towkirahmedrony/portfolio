import Link from "next/link";
import type { ReactNode } from "react";
import { StatusPill } from "@/components/admin/projects/query-state";
import { formatMoney } from "@/lib/admin-dashboard";
import { formatDate, formatDateTime, type QueryResult } from "@/lib/admin-client-constants";
import { formatStatusLabel, getStatusStyle } from "@/lib/admin-projects";
import {
  formatInvoiceStatusLabel,
  formatPaymentStatusLabel,
  formatPaymentTypeLabel,
  getInvoiceStatusStyle,
  getPaymentStatusStyle,
} from "@/lib/admin-invoice-constants";
import {
  formatQuoteStatusLabel,
  getQuoteStatusStyle,
} from "@/lib/admin-quote-constants";
import type {
  AdminClientRelatedData,
  ClientInvoiceSummaryRow,
  ClientMessageSummaryRow,
  ClientPaymentSummaryRow,
  ClientProjectSummaryRow,
  ClientQuoteSummaryRow,
  ClientRequestSummaryRow,
  ClientSummarySection,
} from "@/lib/admin-clients";
import type { RequestStatus, RewardStatus } from "@/types/database";

const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  draft: "Draft",
  new: "New",
  reviewing: "Reviewing",
  quoted: "Quoted",
  approved: "Approved",
  rejected: "Rejected",
  converted: "Converted",
  cancelled: "Cancelled",
};

const REQUEST_STATUS_STYLES: Record<RequestStatus, string> = {
  draft: "bg-slate-500/10 text-slate-700 border-slate-500/20 dark:text-slate-400",
  new: "bg-blue-500/10 text-blue-700 border-blue-500/20 dark:text-blue-400",
  reviewing: "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400",
  quoted: "bg-purple-500/10 text-purple-700 border-purple-500/20 dark:text-purple-400",
  approved: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400",
  rejected: "bg-red-500/10 text-red-700 border-red-500/20 dark:text-red-400",
  converted: "bg-teal-500/10 text-teal-700 border-teal-500/20 dark:text-teal-400",
  cancelled: "bg-neutral-500/10 text-neutral-500 border-neutral-500/20",
};

const REWARD_STATUS_LABELS: Record<RewardStatus, string> = {
  pending: "Pending",
  available: "Available",
  redeemed: "Redeemed",
  expired: "Expired",
  cancelled: "Cancelled",
};

const REWARD_STATUS_STYLES: Record<RewardStatus, string> = {
  pending: "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400",
  available: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400",
  redeemed: "bg-teal-500/10 text-teal-700 border-teal-500/20 dark:text-teal-400",
  expired: "bg-neutral-500/10 text-neutral-500 border-neutral-500/20",
  cancelled: "bg-red-500/10 text-red-700 border-red-500/20 dark:text-red-400",
};

function requestLabel(status: string): string {
  return status in REQUEST_STATUS_LABELS
    ? REQUEST_STATUS_LABELS[status as RequestStatus]
    : status.replace(/_/g, " ");
}

function requestStyle(status: string): string {
  return status in REQUEST_STATUS_STYLES
    ? REQUEST_STATUS_STYLES[status as RequestStatus]
    : "border-card-border bg-background text-muted";
}

function rewardLabel(status: string): string {
  return status in REWARD_STATUS_LABELS
    ? REWARD_STATUS_LABELS[status as RewardStatus]
    : status.replace(/_/g, " ");
}

function rewardStyle(status: string): string {
  return status in REWARD_STATUS_STYLES
    ? REWARD_STATUS_STYLES[status as RewardStatus]
    : "border-card-border bg-background text-muted";
}

type SectionMeta = { total: number; blocked: boolean; message: string };

function sectionMeta(section: ClientSummarySection<unknown>): SectionMeta {
  if (section.status === "ok" || section.status === "empty") {
    return { total: section.data.total, blocked: false, message: "" };
  }
  return { total: 0, blocked: true, message: section.message };
}

function listMeta(section: QueryResult<unknown[]>): SectionMeta {
  if (section.status === "ok" || section.status === "empty") {
    return { total: section.data.length, blocked: false, message: "" };
  }
  return { total: 0, blocked: true, message: section.message };
}

function SectionBody({
  meta,
  children,
  emptyText,
}: {
  meta: SectionMeta;
  children?: ReactNode;
  emptyText: string;
}) {
  if (meta.blocked) {
    return (
      <p className="rounded-xl bg-background px-3 py-2 text-xs text-muted">
        {meta.message}
      </p>
    );
  }
  if (!children || meta.total === 0) {
    return <p className="text-sm text-muted">{emptyText}</p>;
  }
  return <ul className="divide-y divide-card-border/60">{children}</ul>;
}

function PanelHeader({
  title,
  meta,
  viewAllHref,
}: {
  title: string;
  meta: SectionMeta;
  viewAllHref?: string;
}) {
  return (
    <header className="mb-3 flex items-baseline justify-between gap-3">
      <h3 className="font-display text-lg text-foreground">
        {title}
        {!meta.blocked ? (
          <span className="ml-2 text-sm text-muted">{meta.total}</span>
        ) : null}
      </h3>
      {viewAllHref && meta.total > 0 ? (
        <Link
          href={viewAllHref}
          className="text-xs font-medium text-muted hover:text-foreground"
        >
          View all
        </Link>
      ) : null}
    </header>
  );
}

function RowItem({
  href,
  title,
  subtitle,
  trailing,
}: {
  href?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <li className="flex items-center justify-between gap-4 py-2.5">
      <div className="min-w-0">
        {href ? (
          <Link
            href={href}
            className="block truncate text-sm font-medium text-foreground hover:underline"
          >
            {title}
          </Link>
        ) : (
          <p className="truncate text-sm font-medium text-foreground">{title}</p>
        )}
        {subtitle ? (
          <div className="mt-0.5 truncate text-xs text-muted">{subtitle}</div>
        ) : null}
      </div>
      {trailing ? <div className="shrink-0 text-right">{trailing}</div> : null}
    </li>
  );
}

function ProjectRows({ rows }: { rows: ClientProjectSummaryRow[] }) {
  return (
    <>
      {rows.map((row) => (
        <RowItem
          key={row.id}
          href={`/admin/projects/${row.id}`}
          title={row.project_number}
          subtitle={row.title}
          trailing={
            <div className="flex items-center gap-3">
              <span className="hidden text-xs text-muted sm:inline">
                {formatDate(row.created_at)}
              </span>
              <StatusPill
                label={formatStatusLabel(row.status)}
                className={getStatusStyle(row.status)}
              />
            </div>
          }
        />
      ))}
    </>
  );
}

function RequestRows({ rows }: { rows: ClientRequestSummaryRow[] }) {
  return (
    <>
      {rows.map((row) => (
        <RowItem
          key={row.id}
          href={`/admin/project-requests/${row.id}`}
          title={row.request_number}
          subtitle={row.project_type || "Project request"}
          trailing={
            <div className="flex items-center gap-3">
              <span className="hidden text-xs text-muted sm:inline">
                {formatDate(row.submitted_at)}
              </span>
              <StatusPill
                label={requestLabel(row.status)}
                className={requestStyle(row.status)}
              />
            </div>
          }
        />
      ))}
    </>
  );
}

function QuoteRows({
  rows,
  projectsById,
}: {
  rows: ClientQuoteSummaryRow[];
  projectsById: AdminClientRelatedData["projectsById"];
}) {
  return (
    <>
      {rows.map((row) => {
        const project = projectsById.get(row.project_id);
        return (
          <RowItem
            key={row.id}
            href={`/admin/quotes/${row.id}`}
            title={`Quote v${row.version}`}
            subtitle={project ? `${project.project_number} · ${project.title}` : "Project"}
            trailing={
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted">{formatDate(row.created_at)}</span>
                <span className="text-sm font-medium text-foreground">
                  {formatMoney(Number(row.total), row.currency || "BDT")}
                </span>
                <StatusPill
                  label={formatQuoteStatusLabel(row.status)}
                  className={getQuoteStatusStyle(row.status)}
                />
              </div>
            }
          />
        );
      })}
    </>
  );
}

function InvoiceRows({
  rows,
  projectsById,
}: {
  rows: ClientInvoiceSummaryRow[];
  projectsById: AdminClientRelatedData["projectsById"];
}) {
  return (
    <>
      {rows.map((row) => {
        const project = projectsById.get(row.project_id);
        return (
          <RowItem
            key={row.id}
            href={`/admin/invoices/${row.id}`}
            title={row.invoice_number}
            subtitle={project ? project.project_number : undefined}
            trailing={
              <div className="flex items-center gap-3">
                <span className="hidden text-xs text-muted sm:inline">
                  {formatDate(row.issue_date)}
                </span>
                <span className="text-sm font-medium text-foreground">
                  {formatMoney(Number(row.total), row.currency || "BDT")}
                </span>
                <StatusPill
                  label={formatInvoiceStatusLabel(row.status)}
                  className={getInvoiceStatusStyle(row.status)}
                />
              </div>
            }
          />
        );
      })}
    </>
  );
}

function PaymentRows({ rows }: { rows: ClientPaymentSummaryRow[] }) {
  return (
    <>
      {rows.map((row) => (
        <RowItem
          key={row.id}
          title={formatPaymentTypeLabel(row.payment_type)}
          subtitle={formatDate(row.created_at)}
          trailing={
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-foreground">
                {formatMoney(Number(row.amount), row.currency || "BDT")}
              </span>
              <StatusPill
                label={formatPaymentStatusLabel(row.status)}
                className={getPaymentStatusStyle(row.status)}
              />
            </div>
          }
        />
      ))}
    </>
  );
}

function MessageRows({
  rows,
  projectsById,
  clientId,
}: {
  rows: ClientMessageSummaryRow[];
  projectsById: AdminClientRelatedData["projectsById"];
  clientId: string;
}) {
  return (
    <>
      {rows.map((row) => {
        const project = projectsById.get(row.project_id);
        const fromClient = row.sender_id === clientId;
        return (
          <RowItem
            key={row.id}
            href={project ? `/admin/projects/${row.project_id}?tab=messages` : undefined}
            title={
              <span className="flex items-center gap-2">
                {row.is_read ? null : (
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
                    aria-label="Unread message"
                  />
                )}
                <span className="truncate">{row.message}</span>
              </span>
            }
            subtitle={
              project
                ? `${project.project_number} · ${fromClient ? "from client" : "from staff"} · ${formatDateTime(row.created_at)}`
                : `${fromClient ? "from client" : "from staff"} · ${formatDateTime(row.created_at)}`
            }
          />
        );
      })}
    </>
  );
}

function SummaryPanel({
  title,
  section,
  viewAllHref,
  emptyText,
  children,
}: {
  title: string;
  section: ClientSummarySection<unknown>;
  viewAllHref?: string;
  emptyText: string;
  children?: ReactNode;
}) {
  const meta = sectionMeta(section);
  return (
    <section className="rounded-3xl border border-card-border bg-card p-5">
      <PanelHeader title={title} meta={meta} viewAllHref={viewAllHref} />
      <SectionBody meta={meta} emptyText={emptyText}>
        {children}
      </SectionBody>
    </section>
  );
}

export function ClientSummaryPanels({
  data,
  clientId,
}: {
  data: AdminClientRelatedData;
  clientId: string;
}) {
  const codesMeta = listMeta(data.referralCodes);
  const rewardsMeta = listMeta(data.referralRewards);

  return (
    <div className="mt-6 space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <SummaryPanel
          title="Projects"
          section={data.projects}
          viewAllHref="/admin/projects"
          emptyText="No projects yet."
        >
          {data.projects.status === "ok" ? (
            <ProjectRows rows={data.projects.data.rows} />
          ) : null}
        </SummaryPanel>

        <SummaryPanel
          title="Project requests"
          section={data.requests}
          viewAllHref="/admin/project-requests"
          emptyText="No project requests."
        >
          {data.requests.status === "ok" ? (
            <RequestRows rows={data.requests.data.rows} />
          ) : null}
        </SummaryPanel>

        <SummaryPanel
          title="Quotes"
          section={data.quotes}
          viewAllHref="/admin/quotes"
          emptyText="No quotes yet."
        >
          {data.quotes.status === "ok" ? (
            <QuoteRows
              rows={data.quotes.data.rows}
              projectsById={data.projectsById}
            />
          ) : null}
        </SummaryPanel>

        <SummaryPanel
          title="Invoices"
          section={data.invoices}
          viewAllHref="/admin/invoices"
          emptyText="No invoices yet."
        >
          {data.invoices.status === "ok" ? (
            <InvoiceRows
              rows={data.invoices.data.rows}
              projectsById={data.projectsById}
            />
          ) : null}
        </SummaryPanel>

        <SummaryPanel
          title="Payments"
          section={data.payments}
          viewAllHref="/admin/payments"
          emptyText="No payments yet."
        >
          {data.payments.status === "ok" ? (
            <PaymentRows rows={data.payments.data.rows} />
          ) : null}
        </SummaryPanel>

        <SummaryPanel
          title="Messages"
          section={data.messages}
          viewAllHref="/admin/projects"
          emptyText="No project messages."
        >
          {data.messages.status === "ok" ? (
            <MessageRows
              rows={data.messages.data.rows}
              projectsById={data.projectsById}
              clientId={clientId}
            />
          ) : null}
        </SummaryPanel>
      </div>

      <section className="rounded-3xl border border-card-border bg-card p-5">
        <PanelHeader
          title="Referrals"
          meta={{
            total: codesMeta.total + rewardsMeta.total,
            blocked: false,
            message: "",
          }}
        />
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-medium tracking-[0.18em] text-muted uppercase">
              Referral codes ({codesMeta.total})
            </p>
            <SectionBody meta={codesMeta} emptyText="No referral codes.">
              {data.referralCodes.status === "ok"
                ? data.referralCodes.data.map((code) => (
                    <RowItem
                      key={code.id}
                      title={<span className="font-mono tracking-wide">{code.code}</span>}
                      subtitle={`Used ${code.used_count} time${code.used_count === 1 ? "" : "s"} · created ${formatDate(code.created_at)}`}
                      trailing={
                        <StatusPill
                          label={code.is_active ? "Active" : "Inactive"}
                          className={
                            code.is_active
                              ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400"
                              : "bg-neutral-500/10 text-neutral-600 border-neutral-500/20 dark:text-neutral-400"
                          }
                        />
                      }
                    />
                  ))
                : null}
            </SectionBody>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium tracking-[0.18em] text-muted uppercase">
              Rewards earned as referrer ({rewardsMeta.total})
            </p>
            <SectionBody meta={rewardsMeta} emptyText="No referral rewards.">
              {data.referralRewards.status === "ok"
                ? data.referralRewards.data.map((reward) => (
                    <RowItem
                      key={reward.id}
                      title={`${reward.reward_percent}% reward`}
                      subtitle={`Created ${formatDate(reward.created_at)}${
                        reward.expires_at
                          ? ` · expires ${formatDate(reward.expires_at)}`
                          : ""
                      }`}
                      trailing={
                        <StatusPill
                          label={rewardLabel(reward.status)}
                          className={rewardStyle(reward.status)}
                        />
                      }
                    />
                  ))
                : null}
            </SectionBody>
          </div>
        </div>
      </section>
    </div>
  );
}
