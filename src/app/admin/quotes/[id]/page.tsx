import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminPage } from "@/components/admin/admin-page";
import { QueryStateNotice, StatusPill } from "@/components/admin/projects/query-state";
import { QuoteActions } from "@/components/admin/quotes/quote-actions";
import { QuoteEditor } from "@/components/admin/quotes/quote-editor";
import { QuoteVersionHistory } from "@/components/admin/quotes/quote-version-history";
import { clientDisplayName, formatDateTime } from "@/lib/admin-projects";
import {
  canEditQuote,
  formatQuoteStatusLabel,
  getQuoteStatusStyle,
  quoteDisplayId,
} from "@/lib/admin-quote-constants";
import { getAdminQuote, getQuoteProjectOptions } from "@/lib/admin-quotes";
import { requireAdmin } from "@/lib/require-admin";

export default async function AdminQuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const [quoteResult, projectsResult] = await Promise.all([
    getAdminQuote(id),
    getQuoteProjectOptions(),
  ]);

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

  const { quote, items, project, client, versions } = quoteResult.data;
  const editable = canEditQuote(quote.status);
  const projectOptions =
    projectsResult.status === "ok" || projectsResult.status === "empty"
      ? projectsResult.data
      : [];
  const projects = project
    ? [
        {
          ...project,
          client,
        },
        ...projectOptions.filter((option) => option.id !== project.id),
      ]
    : projectOptions;

  return (
    <AdminPage
      title={quoteDisplayId(quote)}
      description={
        project
          ? `${project.project_number} · ${project.title}`
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
      </div>
      {editable ? null : (
        <p className="mb-6 text-sm text-muted">
          This version is {formatQuoteStatusLabel(quote.status).toLowerCase()} and cannot be overwritten. Create a new version to make changes.
        </p>
      )}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <QuoteEditor
          quote={quote}
          items={items}
          projects={projects}
          readOnly={!editable}
        />
        <div className="grid gap-6 self-start">
          <QuoteActions quote={quote} />
          <QuoteVersionHistory versions={versions} currentId={quote.id} />
        </div>
      </div>
    </AdminPage>
  );
}
