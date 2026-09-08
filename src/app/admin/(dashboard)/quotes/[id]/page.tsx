import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminPage } from "@/components/admin/admin-page";
import { QueryStateNotice, StatusPill } from "@/components/admin/projects/query-state";
import { QuoteActions } from "@/components/admin/quotes/quote-actions";
import { QuoteEditor } from "@/components/admin/quotes/quote-editor";
import { QuoteVersionHistory } from "@/components/admin/quotes/quote-version-history";
import {
  isQuoteChangeRequestPending,
} from "@/lib/admin-quote-responses";
import { clientDisplayName, formatDateTime } from "@/lib/admin-projects";
import {
  canEditQuote,
  formatQuoteStatusLabel,
  getQuoteStatusStyle,
  quoteDisplayId,
} from "@/lib/admin-quote-constants";
import { getAdminQuote } from "@/lib/admin-quotes";
import { requireAdmin } from "@/lib/require-admin";

export default async function AdminQuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const quoteResult = await getAdminQuote(id);

  if (quoteResult.status === "empty") {
    notFound();
  }

  if (quoteResult.status === "error" || quoteResult.status === "unavailable") {
    return (
      <AdminPage
        title="Quote"
        description="Could not load this quote."
        className="mx-auto w-full max-w-6xl"
      >
        <QueryStateNotice result={quoteResult} />
      </AdminPage>
    );
  }

  const { quote, items, project, request, client, versions, invoice } = quoteResult.data;
  const editable = canEditQuote(quote.status);

  const hasClientChangeRequest = Boolean(quote.client_change_requested_at);
  const changeRequestOpen =
    hasClientChangeRequest &&
    isQuoteChangeRequestPending(
      { status: quote.status, createdAt: quote.client_change_requested_at ?? quote.created_at },
      versions
        .filter((version) => version.id !== quote.id)
        .map((version) => ({ status: version.status, createdAt: version.created_at })),
    );

  return (
    <AdminPage
      title={quoteDisplayId(quote)}
      description={
        project
          ? `${project.project_number} · ${project.title}`
          : request
            ? `${request.request_number}${request.project_type ? ` · ${request.project_type}` : ""}`
            : "Quote detail"
      }
      className="mx-auto w-full max-w-6xl"
    >
      <Link
        href="/admin/quotes"
        className="mb-6 inline-block text-sm text-muted hover:text-foreground"
      >
        Back to all quotes
      </Link>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <StatusPill
          label={formatQuoteStatusLabel(quote.status)}
          className={getQuoteStatusStyle(quote.status)}
        />
        <span className="text-sm text-muted">{clientDisplayName(client)}</span>
        {quote.sent_at ? (
          <span className="text-sm text-muted">Sent {formatDateTime(quote.sent_at)}</span>
        ) : (
          <span className="text-sm text-muted">Created {formatDateTime(quote.created_at)}</span>
        )}
        {hasClientChangeRequest ? (
          <StatusPill
            label="Changes requested"
            className="bg-amber-500/10 text-amber-700 border-amber-500/25 dark:text-amber-400"
          />
        ) : null}
        {project ? (
          <Link
            href={`/admin/projects/${project.id}?tab=messages`}
            className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-card-border bg-card px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:border-accent/40 hover:text-accent"
          >
            Chat with Client
            <span aria-hidden>&rarr;</span>
          </Link>
        ) : request ? (
          <Link
            href={`/admin/project-requests/${request.id}/messages`}
            className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-card-border bg-card px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:border-accent/40 hover:text-accent"
          >
            Chat with Client
            <span aria-hidden>&rarr;</span>
          </Link>
        ) : null}
      </div>
      {hasClientChangeRequest && quote.client_change_message ? (
        <div
          className={`mb-6 rounded-2xl border px-5 py-4 ${
            changeRequestOpen
              ? "border-amber-500/30 bg-amber-500/10"
              : "border-card-border bg-card"
          }`}
        >
          <p className="text-sm font-medium text-foreground">
            {changeRequestOpen ? "Client is waiting on a revised quote" : "Client requested changes (later revised)"}
          </p>
          <p className="mt-1 whitespace-pre-line text-sm leading-6 text-muted">
            {quote.client_change_message}
          </p>
          <p className="mt-2 text-xs text-muted">
            Requested {formatDateTime(quote.client_change_requested_at)} on Quote v
            {quote.version}.{" "}
            {changeRequestOpen
              ? "Create a new version from the Actions panel and send it to revise this quote."
              : "A newer quote version has already been sent or accepted."}
          </p>
        </div>
      ) : null}
      {editable ? null : (
        <p className="mb-6 text-sm text-muted">
          This version is {formatQuoteStatusLabel(quote.status).toLowerCase()} and cannot be overwritten. Create a new version to make changes.
        </p>
      )}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <QuoteEditor
          quote={quote}
          items={items}
          request={request}
          client={client}
          project={project}
          readOnly={!editable}
        />
        <div className="grid gap-6 self-start">
          <QuoteActions quote={quote} invoice={invoice} />
          <QuoteVersionHistory versions={versions} currentId={quote.id} />
        </div>
      </div>
    </AdminPage>
  );
}
