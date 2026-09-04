import { Suspense } from "react";
import { AdminPage } from "@/components/admin/admin-page";
import { ContactInbox } from "@/components/admin/contact-messages/contact-inbox";
import { ContactToolbar } from "@/components/admin/contact-messages/contact-toolbar";
import { ContentListSkeleton } from "@/components/admin/content/content-skeletons";
import { QueryStateNotice } from "@/components/admin/projects/query-state";
import type { ContactFilters } from "@/lib/admin-contact-constants";
import { getContactMessages } from "@/lib/admin-contact";
import { requireAdmin } from "@/lib/require-admin";

async function ContactContent({ filters }: { filters: ContactFilters }) {
  const result = await getContactMessages(filters);

  if (result.status === "error" || result.status === "unavailable") {
    return <QueryStateNotice result={result} />;
  }

  if (result.status === "empty" || result.data.length === 0) {
    const hasQuery = Boolean(filters.q?.trim());
    return (
      <div className="rounded-3xl border border-dashed border-card-border bg-card p-10 text-center">
        <p className="text-sm text-muted">
          {hasQuery
            ? "No messages match your search."
            : filters.status && filters.status !== "all"
              ? "No messages in this state."
              : "No contact messages yet."}
        </p>
      </div>
    );
  }

  return <ContactInbox messages={result.data} />;
}

export default async function AdminContactMessagesPage({
  searchParams,
}: {
  searchParams: Promise<ContactFilters>;
}) {
  await requireAdmin();
  const filters = await searchParams;
  const current = filters.status ?? "all";
  const search = filters.q ?? "";

  return (
    <AdminPage
      title="Contact Inbox"
      description="Messages submitted through the public contact form. Opening an unread message marks it read (read_at set once); replies compose in your email client — no email provider is wired up yet."
      className="mx-auto w-full max-w-6xl"
    >
      <ContactToolbar current={current} search={search} />
      <Suspense fallback={<ContentListSkeleton />}>
        <ContactContent filters={filters} />
      </Suspense>
    </AdminPage>
  );
}
