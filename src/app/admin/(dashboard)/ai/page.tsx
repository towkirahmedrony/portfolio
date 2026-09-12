import { Suspense } from "react";
import { AdminPage } from "@/components/admin/admin-page";
import { AdminAiTabs } from "@/components/admin/ai/ai-tabs";
import { AiOverview } from "@/components/admin/ai/ai-overview";
import { AiKnowledgePanel } from "@/components/admin/ai/ai-knowledge";
import { AiRulesPanel } from "@/components/admin/ai/ai-rules";
import { AiFaqsPanel } from "@/components/admin/ai/ai-faqs";
import { AiSettingsPanel } from "@/components/admin/ai/ai-settings";
import {
  AiConversationDetail,
  AiConversationsList,
  AiConversationsToolbar,
} from "@/components/admin/ai/ai-conversations";
import { ContentListSkeleton } from "@/components/admin/content/content-skeletons";
import {
  getAdminAiConversationDetail,
  getAdminAiConversations,
  getAdminAiFaqs,
  getAdminAiKnowledge,
  getAdminAiOverview,
  getAdminAiRules,
  getAdminAiSettings,
} from "@/lib/admin-ai";
import {
  parseAdminAiTab,
  type AdminAiPageFilters,
} from "@/lib/admin-ai-constants";
import { requireAdmin } from "@/lib/require-admin";

async function OverviewContent() {
  const { stats, recent } = await getAdminAiOverview();
  return <AiOverview stats={stats} recent={recent} />;
}

async function KnowledgeContent({ filters }: { filters: AdminAiPageFilters }) {
  const result = await getAdminAiKnowledge();
  return <AiKnowledgePanel result={result} filters={filters} />;
}

async function RulesContent({ filters }: { filters: AdminAiPageFilters }) {
  const result = await getAdminAiRules();
  return <AiRulesPanel result={result} filters={filters} />;
}

async function FaqsContent({ filters }: { filters: AdminAiPageFilters }) {
  const result = await getAdminAiFaqs();
  return <AiFaqsPanel result={result} filters={filters} />;
}

async function SettingsContent() {
  const result = await getAdminAiSettings();
  return <AiSettingsPanel result={result} />;
}

async function ConversationsContent({ filters }: { filters: AdminAiPageFilters }) {
  const [list, detail] = await Promise.all([
    getAdminAiConversations(filters),
    filters.session ? getAdminAiConversationDetail(filters.session) : Promise.resolve(null),
  ]);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <div className={filters.session ? "order-2 xl:order-1" : undefined}>
        <AiConversationsList result={list} filters={filters} />
      </div>
      <div className={filters.session ? "order-1 xl:order-2" : undefined}>
        <AiConversationDetail result={detail} filters={filters} />
      </div>
    </div>
  );
}

export default async function AdminAiPage({
  searchParams,
}: {
  searchParams: Promise<AdminAiPageFilters>;
}) {
  await requireAdmin();
  const filters = await searchParams;
  const tab = parseAdminAiTab(filters.tab);

  return (
    <AdminPage
      title="AI"
      description="Admin control center for Nora: knowledge, rules, FAQs, settings, and conversation monitoring. Live data from the existing AI tables. Monitoring is read-only."
      className="mx-auto w-full max-w-7xl"
    >
      <AdminAiTabs active={tab} />
      <Suspense fallback={<ContentListSkeleton />}>
        {tab === "overview" ? <OverviewContent /> : null}
        {tab === "knowledge" ? <KnowledgeContent filters={filters} /> : null}
        {tab === "rules" ? <RulesContent filters={filters} /> : null}
        {tab === "faqs" ? <FaqsContent filters={filters} /> : null}
        {tab === "settings" ? <SettingsContent /> : null}
        {tab === "conversations" ? (
          <>
            <AiConversationsToolbar filters={filters} />
            <ConversationsContent filters={filters} />
          </>
        ) : null}
      </Suspense>
    </AdminPage>
  );
}
