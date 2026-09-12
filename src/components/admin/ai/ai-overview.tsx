import Link from "next/link";
import { QueryStateNotice } from "@/components/admin/projects/query-state";
import {
  ConversationStatusBadge,
  IdentityBadge,
} from "@/components/admin/ai/ai-common";
import {
  buildAdminAiHref,
  formatDateTime,
  shortSessionId,
  type AdminAiConversationListItem,
  type AdminAiOverviewStats,
  type QueryResult,
} from "@/lib/admin-ai-constants";

function metricValue(result: QueryResult<number>): string {
  if (result.status === "error" || result.status === "unavailable") {
    return "—";
  }
  return String(result.data);
}

function enabledLabel(result: QueryResult<boolean | null>): string {
  if (result.status === "error" || result.status === "unavailable") {
    return "Unknown";
  }
  if (result.status === "empty" || result.data == null) {
    return "Not set";
  }
  return result.data ? "Enabled" : "Disabled";
}

const STATS: Array<{
  id: string;
  label: string;
  description: string;
  href?: string;
  value: (stats: AdminAiOverviewStats) => string;
}> = [
  {
    id: "knowledge-total",
    label: "Knowledge items",
    description: "All rows in ai_knowledge",
    href: buildAdminAiHref({ tab: "knowledge" }),
    value: (stats) => metricValue(stats.knowledgeTotal),
  },
  {
    id: "knowledge-active",
    label: "Active knowledge",
    description: "is_active = true",
    href: buildAdminAiHref({ tab: "knowledge" }),
    value: (stats) => metricValue(stats.knowledgeActive),
  },
  {
    id: "rules-total",
    label: "Rules",
    description: "All rows in ai_rules",
    href: buildAdminAiHref({ tab: "rules" }),
    value: (stats) => metricValue(stats.rulesTotal),
  },
  {
    id: "faqs-active",
    label: "Active FAQs",
    description: "is_active = true",
    href: buildAdminAiHref({ tab: "faqs" }),
    value: (stats) => metricValue(stats.faqsActive),
  },
  {
    id: "ai-status",
    label: "AI status",
    description: "ai_settings.enabled",
    href: buildAdminAiHref({ tab: "settings" }),
    value: (stats) => enabledLabel(stats.aiEnabled),
  },
  {
    id: "conversations-total",
    label: "Conversations",
    description: "All ai_chat_sessions",
    href: buildAdminAiHref({ tab: "conversations" }),
    value: (stats) => metricValue(stats.conversationsTotal),
  },
  {
    id: "conversations-today",
    label: "Conversations today",
    description: "Created since UTC midnight",
    href: buildAdminAiHref({ tab: "conversations", date: "today" }),
    value: (stats) => metricValue(stats.conversationsToday),
  },
  {
    id: "messages-today",
    label: "Messages today",
    description: "ai_chat_messages since UTC midnight",
    href: buildAdminAiHref({ tab: "conversations", date: "today" }),
    value: (stats) => metricValue(stats.messagesToday),
  },
];

export function AiOverview({
  stats,
  recent,
}: {
  stats: AdminAiOverviewStats;
  recent: QueryResult<AdminAiConversationListItem[]>;
}) {
  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {STATS.map((stat) => {
          const body = (
            <>
              <p className="text-xs font-medium tracking-[0.16em] text-muted uppercase">
                {stat.label}
              </p>
              <p className="mt-3 font-display text-3xl tracking-tight text-foreground">
                {stat.value(stats)}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted">{stat.description}</p>
            </>
          );
          const className =
            "flex h-full flex-col rounded-3xl border border-card-border bg-card p-6 text-left";
          return stat.href ? (
            <Link key={stat.id} href={stat.href} className={`${className} hover:border-foreground/25`}>
              {body}
            </Link>
          ) : (
            <article key={stat.id} className={className}>
              {body}
            </article>
          );
        })}
      </div>

      <section className="rounded-3xl border border-card-border bg-card p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg text-foreground">Recent conversations</h3>
            <p className="mt-1 text-sm text-muted">Latest activity from ai_chat_sessions.</p>
          </div>
          <Link
            href={buildAdminAiHref({ tab: "conversations" })}
            className="rounded-xl border border-card-border px-3 py-2 text-sm font-medium text-foreground hover:border-foreground"
          >
            View all
          </Link>
        </div>
        {recent.status === "error" || recent.status === "unavailable" ? (
          <QueryStateNotice result={recent} />
        ) : recent.status === "empty" || recent.data.length === 0 ? (
          <p className="text-sm text-muted">No conversations yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[48rem] text-left text-sm">
              <thead className="border-b border-card-border text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-2">Session</th>
                  <th className="px-3 py-2">User</th>
                  <th className="px-3 py-2">Preview</th>
                  <th className="px-3 py-2">Messages</th>
                  <th className="px-3 py-2">Last activity</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {recent.data.map((item) => (
                  <tr key={item.id} className="border-b border-card-border/60 last:border-0">
                    <td className="px-3 py-3">
                      <Link
                        href={buildAdminAiHref({ tab: "conversations", session: item.id })}
                        className="font-mono text-xs text-foreground hover:underline"
                      >
                        {shortSessionId(item.id)}
                      </Link>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col gap-1">
                        <IdentityBadge anonymous={item.isAnonymous} />
                        {item.user ? (
                          <span className="text-xs text-muted">{item.user.name}</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="max-w-xs truncate px-3 py-3 text-muted">
                      {item.preview || item.title || "Untitled"}
                    </td>
                    <td className="px-3 py-3">{item.messageCount}</td>
                    <td className="px-3 py-3 text-muted">{formatDateTime(item.lastActivity)}</td>
                    <td className="px-3 py-3">
                      <ConversationStatusBadge status={item.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
