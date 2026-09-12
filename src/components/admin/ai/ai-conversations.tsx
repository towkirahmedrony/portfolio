"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  ConversationStatusBadge,
  EmptyPanel,
  IdentityBadge,
} from "@/components/admin/ai/ai-common";
import { QueryStateNotice } from "@/components/admin/projects/query-state";
import {
  AI_CONVERSATION_DATE_FILTERS,
  AI_CONVERSATION_DATE_LABELS,
  AI_CONVERSATION_FILTERS,
  AI_CONVERSATION_FILTER_LABELS,
  AI_CONVERSATION_PAGE_SIZE,
  buildAdminAiHref,
  formatDateTime,
  shortSessionId,
  type AdminAiConversationDetail,
  type AdminAiConversationListItem,
  type AdminAiPageFilters,
  type AdminAiPaginated,
  type QueryResult,
} from "@/lib/admin-ai-constants";

export function AiConversationsToolbar({ filters }: { filters: AdminAiPageFilters }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function push(next: AdminAiPageFilters) {
    startTransition(() => {
      router.push(
        buildAdminAiHref({
          tab: "conversations",
          q: next.q,
          filter: next.filter,
          date: next.date,
          session: filters.session,
        }),
      );
    });
  }

  return (
    <div className="mb-6 space-y-3">
      <form
        className="grid gap-3 rounded-3xl border border-card-border bg-card p-4 sm:grid-cols-[minmax(0,1fr)_auto_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          push({
            q: String(data.get("q") ?? "").trim(),
            filter: filters.filter,
            date: filters.date,
          });
        }}
      >
        <input
          name="q"
          defaultValue={filters.q ?? ""}
          placeholder="Search session ID, user ID, title, or message"
          className="rounded-xl border border-card-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-60"
        >
          Search
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => router.refresh()}
          className="rounded-xl border border-card-border px-3 py-2 text-sm font-medium text-foreground disabled:opacity-60"
        >
          Refresh
        </button>
      </form>

      <div className="flex flex-wrap gap-2 rounded-3xl border border-card-border bg-card p-2">
        {AI_CONVERSATION_FILTERS.map((filter) => (
          <button
            key={filter}
            type="button"
            disabled={pending}
            onClick={() => push({ q: filters.q, filter, date: filters.date })}
            className={`rounded-2xl px-4 py-2 text-sm font-medium disabled:opacity-60 ${
              (filters.filter ?? "all") === filter
                ? "bg-foreground text-background"
                : "text-muted hover:text-foreground"
            }`}
          >
            {AI_CONVERSATION_FILTER_LABELS[filter]}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 rounded-3xl border border-card-border bg-card p-2">
        {AI_CONVERSATION_DATE_FILTERS.map((date) => (
          <button
            key={date}
            type="button"
            disabled={pending}
            onClick={() => push({ q: filters.q, filter: filters.filter, date })}
            className={`rounded-2xl px-4 py-2 text-sm font-medium disabled:opacity-60 ${
              (filters.date ?? "all") === date
                ? "bg-foreground text-background"
                : "text-muted hover:text-foreground"
            }`}
          >
            {AI_CONVERSATION_DATE_LABELS[date]}
          </button>
        ))}
      </div>
    </div>
  );
}

function ConversationsPagination({
  filters,
  page,
  total,
  totalPages,
}: {
  filters: AdminAiPageFilters;
  page: number;
  total: number;
  totalPages: number;
}) {
  if (totalPages <= 1) {
    return null;
  }
  const start = (page - 1) * AI_CONVERSATION_PAGE_SIZE + 1;
  const end = Math.min(page * AI_CONVERSATION_PAGE_SIZE, total);
  return (
    <nav
      aria-label="Conversation pagination"
      className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted"
    >
      <p>
        Showing {start}–{end} of {total} · Page {page} of {totalPages}
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link
            href={buildAdminAiHref({
              ...filters,
              tab: "conversations",
              page: String(page - 1),
            })}
            className="rounded-xl border border-card-border bg-card px-3 py-2 text-sm font-medium text-foreground"
          >
            Previous
          </Link>
        ) : null}
        {page < totalPages ? (
          <Link
            href={buildAdminAiHref({
              ...filters,
              tab: "conversations",
              page: String(page + 1),
            })}
            className="rounded-xl border border-card-border bg-card px-3 py-2 text-sm font-medium text-foreground"
          >
            Next
          </Link>
        ) : null}
      </div>
    </nav>
  );
}

export function AiConversationsList({
  result,
  filters,
}: {
  result: QueryResult<AdminAiPaginated<AdminAiConversationListItem>>;
  filters: AdminAiPageFilters;
}) {
  if (result.status === "error" || result.status === "unavailable") {
    return <QueryStateNotice result={result} />;
  }

  const data = result.status === "empty" ? { items: [], total: 0, page: 1, totalPages: 1 } : result.data;
  if (data.items.length === 0) {
    return <EmptyPanel message="No conversations match the current filters." />;
  }

  return (
    <>
      <div className="overflow-x-auto rounded-3xl border border-card-border bg-card">
        <table className="w-full min-w-[56rem] text-left text-sm">
          <thead className="border-b border-card-border text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Session</th>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Messages</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Last activity</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item) => (
              <tr
                key={item.id}
                className={`border-b border-card-border/60 last:border-0 ${
                  filters.session === item.id ? "bg-accent-soft/40" : ""
                }`}
              >
                <td className="px-4 py-3">
                  <Link
                    href={buildAdminAiHref({
                      ...filters,
                      tab: "conversations",
                      session: item.id,
                    })}
                    className="font-mono text-xs text-foreground hover:underline"
                  >
                    {shortSessionId(item.id)}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1">
                    <IdentityBadge anonymous={item.isAnonymous} />
                    {item.user ? <span className="text-xs text-muted">{item.user.name}</span> : null}
                    {item.userId ? (
                      <span className="font-mono text-[11px] text-muted">{item.userId.slice(0, 8)}</span>
                    ) : null}
                  </div>
                </td>
                <td className="max-w-xs truncate px-4 py-3 text-muted">
                  {item.title || item.preview || "Untitled"}
                </td>
                <td className="px-4 py-3">{item.messageCount}</td>
                <td className="px-4 py-3 text-muted">{formatDateTime(item.createdAt)}</td>
                <td className="px-4 py-3 text-muted">{formatDateTime(item.lastActivity)}</td>
                <td className="px-4 py-3">
                  <ConversationStatusBadge status={item.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ConversationsPagination
        filters={filters}
        page={data.page}
        total={data.total}
        totalPages={data.totalPages}
      />
    </>
  );
}

export function AiConversationDetail({
  result,
  filters,
}: {
  result: QueryResult<AdminAiConversationDetail> | null;
  filters: AdminAiPageFilters;
}) {
  if (!filters.session) {
    return (
      <div className="rounded-3xl border border-dashed border-card-border bg-card p-6 text-sm text-muted">
        Select a conversation to inspect its message history. This view is read-only.
      </div>
    );
  }

  if (!result || result.status === "empty") {
    return <EmptyPanel message="Conversation not found." />;
  }
  if (result.status === "error" || result.status === "unavailable") {
    return <QueryStateNotice result={result} />;
  }

  const detail = result.data;
  return (
    <section className="rounded-3xl border border-card-border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-[0.16em] text-muted uppercase">
            Admin monitoring
          </p>
          <h3 className="font-display mt-1 text-lg text-foreground">
            {detail.session.title || "Untitled conversation"}
          </h3>
          <p className="mt-1 font-mono text-xs text-muted">{detail.session.id}</p>
        </div>
        <Link
          href={buildAdminAiHref({ ...filters, tab: "conversations", session: undefined })}
          className="rounded-xl border border-card-border px-3 py-2 text-sm font-medium text-foreground"
        >
          Close
        </Link>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <IdentityBadge anonymous={detail.isAnonymous} />
        <ConversationStatusBadge status={detail.status} />
        <span className="inline-flex rounded-full border border-card-border px-2.5 py-1 text-xs text-muted">
          {detail.messageCount} messages
        </span>
        {detail.user ? (
          <span className="inline-flex rounded-full border border-card-border px-2.5 py-1 text-xs text-muted">
            {detail.user.name}
          </span>
        ) : null}
        {detail.session.user_id ? (
          <span className="inline-flex rounded-full border border-card-border px-2.5 py-1 font-mono text-xs text-muted">
            {detail.session.user_id}
          </span>
        ) : null}
      </div>
      <div className="space-y-3">
        {detail.messages.length === 0 ? (
          <p className="text-sm text-muted">No messages in this conversation.</p>
        ) : (
          detail.messages.map((message) => {
            const isNora = message.role === "assistant";
            return (
              <article
                key={message.id}
                className={`max-w-[90%] rounded-2xl border px-4 py-3 ${
                  isNora
                    ? "border-card-border bg-background"
                    : "ml-auto border-transparent bg-foreground text-background"
                }`}
              >
                <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                  <span className={isNora ? "font-medium text-foreground" : "font-medium"}>
                    {isNora ? "Nora" : "User"}
                  </span>
                  <span className={isNora ? "text-muted" : "opacity-80"}>
                    {formatDateTime(message.created_at)}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
