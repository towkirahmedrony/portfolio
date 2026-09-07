import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { InvoiceStatus, QuoteStatus } from "@/types/database";

export type DashboardQueryState<T> =
  | { status: "ok"; data: T }
  | { status: "empty"; data: T }
  | { status: "error"; message: string }
  | { status: "unavailable"; message: string };

export type MoneyByCurrency = {
  currency: string;
  amount: number;
};

export type DashboardMetric = {
  id: string;
  label: string;
  value: string;
  description: string;
  state: Exclude<DashboardQueryState<unknown>["status"], "empty"> | "ok";
  message?: string;
};

export type DashboardActionItem = {
  id: string;
  label: string;
  count: number;
  description: string;
  state: DashboardQueryState<unknown>["status"];
  message?: string;
};

export type DashboardActivityItem = {
  id: string;
  actor: string;
  action: string;
  entity: string;
  timestamp: string;
};

export type AdminDashboardData = {
  metrics: DashboardMetric[];
  actions: DashboardActionItem[];
  activity: DashboardQueryState<DashboardActivityItem[]>;
};

const ACTIVE_PROJECT_STATUSES = [
  "pending",
  "approved",
  "in_progress",
  "on_hold",
  "in_review",
  "revision",
] as const;

const OPEN_INVOICE_STATUSES: InvoiceStatus[] = [
  "issued",
  "partially_paid",
  "overdue",
];

const QUOTE_ACTION_STATUSES: QuoteStatus[] = ["draft", "expired"];
const REWARD_ACTION_STATUSES = ["pending"] as const;
const ACTIVITY_LIMIT = 12;

type CountResult = { count: number | null; error: { message: string; code?: string } | null };
type RowsResult<T> = { data: T[] | null; error: { message: string; code?: string } | null };

function startOfUtcDay(date = new Date()): string {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  ).toISOString();
}

function startOfUtcMonth(date = new Date()): string {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1),
  ).toISOString();
}

function isMissingRelation(error: { message?: string; code?: string } | null): boolean {
  if (!error) {
    return false;
  }

  const message = (error.message ?? "").toLowerCase();
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    error.code === "PGRST200" ||
    message.includes("does not exist") ||
    message.includes("schema cache") ||
    message.includes("could not find the table") ||
    message.includes("could not find a relationship")
  );
}

function relationUnavailable(table: string): string {
  return `${table} is not available in the current database schema, so this figure cannot be calculated.`;
}

function toCountState(
  result: CountResult,
  table: string,
): DashboardQueryState<number> {
  if (result.error) {
    if (isMissingRelation(result.error)) {
      return { status: "unavailable", message: relationUnavailable(table) };
    }

    return { status: "error", message: result.error.message };
  }

  const count = result.count ?? 0;
  return count === 0
    ? { status: "empty", data: 0 }
    : { status: "ok", data: count };
}

function sumByCurrency(
  rows: Array<{ amount: number | string | null; currency: string | null }>,
): MoneyByCurrency[] {
  const totals = new Map<string, number>();

  for (const row of rows) {
    const currency = row.currency?.trim() || "BDT";
    const amount = Number(row.amount ?? 0);
    if (!Number.isFinite(amount)) {
      continue;
    }
    totals.set(currency, (totals.get(currency) ?? 0) + amount);
  }

  return [...totals.entries()].map(([currency, amount]) => ({ currency, amount }));
}

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    const digits = amount % 1 === 0 ? 0 : 2;
    return `${amount.toFixed(digits)} ${currency}`;
  }
}

export function formatMoneyList(items: MoneyByCurrency[]): string {
  if (items.length === 0) {
    return formatMoney(0, "BDT");
  }

  return items.map((item) => formatMoney(item.amount, item.currency)).join(" · ");
}

export function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown time";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

function formatActionLabel(action: string): string {
  return action.replace(/[_-]+/g, " ").trim();
}

type ActivityEntityRefs = {
  requestNumbers?: Map<string, string>;
  projectNumbers?: Map<string, string>;
  invoiceNumbers?: Map<string, string>;
  quoteVersions?: Map<string, number>;
};

function formatEntity(
  entityType: string,
  entityId: string | null,
  refs?: ActivityEntityRefs,
): string {
  const type = formatActionLabel(entityType);
  if (!entityId) {
    return type;
  }

  const requestNumber =
    entityType === "project_request" || entityType === "request"
      ? refs?.requestNumbers?.get(entityId)
      : undefined;
  if (requestNumber) {
    return `request ${requestNumber}`;
  }

  if (entityType === "project") {
    const projectNumber = refs?.projectNumbers?.get(entityId);
    if (projectNumber) {
      return `project ${projectNumber}`;
    }
  }

  if (entityType === "invoice") {
    const invoiceNumber = refs?.invoiceNumbers?.get(entityId);
    if (invoiceNumber) {
      return `invoice ${invoiceNumber}`;
    }
  }

  if (entityType === "quote") {
    const version = refs?.quoteVersions?.get(entityId);
    if (version != null) {
      return `quote v${version}`;
    }
  }

  return `${type} ${entityId.slice(0, 8)}`;
}

function metricFromCount(
  id: string,
  label: string,
  description: string,
  state: DashboardQueryState<number>,
  format: (value: number) => string = (value) => String(value),
): DashboardMetric {
  if (state.status === "unavailable" || state.status === "error") {
    return {
      id,
      label,
      value: "—",
      description,
      state: state.status,
      message: state.message,
    };
  }

  return {
    id,
    label,
    value: format(state.data),
    description,
    state: "ok",
  };
}

function actionFromCount(
  id: string,
  label: string,
  description: string,
  state: DashboardQueryState<number>,
): DashboardActionItem {
  if (state.status === "unavailable" || state.status === "error") {
    return {
      id,
      label,
      count: 0,
      description,
      state: state.status,
      message: state.message,
    };
  }

  return {
    id,
    label,
    count: state.data,
    description,
    state: state.data === 0 ? "empty" : "ok",
  };
}

export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const adminUserId = user?.id ?? "";
  const todayStart = startOfUtcDay();
  const monthStart = startOfUtcMonth();

  const [
    leadsResult,
    projectsResult,
    invoicesResult,
    paymentsResult,
    quotesResult,
    messagesResult,
    rewardsResult,
    activityResult,
  ] = await Promise.all([
    supabase
      .from("project_requests")
      .select("id", { count: "exact", head: true })
      .gte("submitted_at", todayStart),
    supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .in("status", [...ACTIVE_PROJECT_STATUSES]),
    supabase
      .from("invoices")
      .select("amount_due, currency, status")
      .in("status", OPEN_INVOICE_STATUSES),
    supabase
      .from("payments")
      .select("amount, currency")
      .eq("status", "succeeded")
      .gte("paid_at", monthStart),
    supabase
      .from("quotes")
      .select("id", { count: "exact", head: true })
      .in("status", QUOTE_ACTION_STATUSES),
    supabase
      .from("project_messages")
      .select("id", { count: "exact", head: true })
      .eq("is_read", false)
      .neq("sender_id", adminUserId),
    supabase
      .from("referral_rewards")
      .select("id", { count: "exact", head: true })
      .in("status", [...REWARD_ACTION_STATUSES]),
    supabase
      .from("audit_logs")
      .select("id, actor_id, action, entity_type, entity_id, created_at")
      .order("created_at", { ascending: false })
      .limit(ACTIVITY_LIMIT),
  ]);

  const leadsState = toCountState(leadsResult as CountResult, "project_requests");
  const projectsState = toCountState(projectsResult as CountResult, "projects");
  const quotesState = toCountState(quotesResult as CountResult, "quotes");
  const messagesState = toCountState(
    messagesResult as CountResult,
    "project_messages",
  );
  const rewardsState = toCountState(
    rewardsResult as CountResult,
    "referral_rewards",
  );

  const invoiceRows = invoicesResult as RowsResult<{
    amount_due: number | string | null;
    currency: string | null;
    status: InvoiceStatus;
  }>;
  let invoiceAmountState: DashboardQueryState<MoneyByCurrency[]>;
  let overdueCountState: DashboardQueryState<number>;

  if (invoiceRows.error) {
    const message = isMissingRelation(invoiceRows.error)
      ? relationUnavailable("invoices")
      : invoiceRows.error.message;
    const status = isMissingRelation(invoiceRows.error) ? "unavailable" : "error";
    invoiceAmountState = { status, message };
    overdueCountState = { status, message };
  } else {
    const rows = invoiceRows.data ?? [];
    const amounts = sumByCurrency(
      rows.map((row) => ({ amount: row.amount_due, currency: row.currency })),
    );
    const overdueCount = rows.filter((row) => row.status === "overdue").length;
    invoiceAmountState =
      amounts.length === 0 || amounts.every((item) => item.amount === 0)
        ? { status: "empty", data: [{ currency: "BDT", amount: 0 }] }
        : { status: "ok", data: amounts };
    overdueCountState =
      overdueCount === 0
        ? { status: "empty", data: 0 }
        : { status: "ok", data: overdueCount };
  }

  const paymentRows = paymentsResult as RowsResult<{
    amount: number | string | null;
    currency: string | null;
  }>;
  let revenueState: DashboardQueryState<MoneyByCurrency[]>;

  if (paymentRows.error) {
    revenueState = isMissingRelation(paymentRows.error)
      ? { status: "unavailable", message: relationUnavailable("payments") }
      : { status: "error", message: paymentRows.error.message };
  } else {
    const amounts = sumByCurrency(paymentRows.data ?? []);
    revenueState =
      amounts.length === 0 || amounts.every((item) => item.amount === 0)
        ? { status: "empty", data: [{ currency: "BDT", amount: 0 }] }
        : { status: "ok", data: amounts };
  }

  const activityRows = activityResult as RowsResult<{
    id: string;
    actor_id: string | null;
    action: string;
    entity_type: string;
    entity_id: string | null;
    created_at: string;
  }>;
  let activity: DashboardQueryState<DashboardActivityItem[]>;

  if (activityRows.error) {
    activity = isMissingRelation(activityRows.error)
      ? { status: "unavailable", message: relationUnavailable("audit_logs") }
      : { status: "error", message: activityRows.error.message };
  } else {
    const rows = activityRows.data ?? [];
    const actorIds = [
      ...new Set(rows.map((row) => row.actor_id).filter((id): id is string => Boolean(id))),
    ];
    const actorNames = new Map<string, string>();

    if (actorIds.length > 0) {
      const { data: actors } = await supabase
        .from("profiles")
        .select("id, full_name, display_name")
        .in("id", actorIds);

      for (const actor of actors ?? []) {
        const name = actor.display_name?.trim() || actor.full_name.trim();
        if (name) {
          actorNames.set(actor.id, name);
        }
      }
    }

    // Resolve audit entities to their human-facing numbers (PR-... / PJ-... /
    // INV-...) instead of showing truncated UUIDs in the activity feed.
    const requestEntityIds = rows
      .filter((row) => row.entity_type === "project_request" || row.entity_type === "request")
      .map((row) => row.entity_id)
      .filter((id): id is string => Boolean(id));
    const projectEntityIds = rows
      .filter((row) => row.entity_type === "project")
      .map((row) => row.entity_id)
      .filter((id): id is string => Boolean(id));
    const invoiceEntityIds = rows
      .filter((row) => row.entity_type === "invoice")
      .map((row) => row.entity_id)
      .filter((id): id is string => Boolean(id));
    const quoteEntityIds = rows
      .filter((row) => row.entity_type === "quote")
      .map((row) => row.entity_id)
      .filter((id): id is string => Boolean(id));

    const requestNumbers = new Map<string, string>();
    const projectNumbers = new Map<string, string>();
    const invoiceNumbers = new Map<string, string>();
    const quoteVersions = new Map<string, number>();

    const entityRefs: ActivityEntityRefs = {
      requestNumbers,
      projectNumbers,
      invoiceNumbers,
      quoteVersions,
    };

    if (requestEntityIds.length > 0) {
      const { data: requestRows } = await supabase
        .from("project_requests")
        .select("id, request_number")
        .in("id", requestEntityIds);
      for (const row of requestRows ?? []) {
        requestNumbers.set(row.id, row.request_number);
      }
    }
    if (projectEntityIds.length > 0) {
      const { data: projectRows } = await supabase
        .from("projects")
        .select("id, project_number")
        .in("id", projectEntityIds);
      for (const row of projectRows ?? []) {
        projectNumbers.set(row.id, row.project_number);
      }
    }
    if (invoiceEntityIds.length > 0) {
      const { data: invoiceRows } = await supabase
        .from("invoices")
        .select("id, invoice_number")
        .in("id", invoiceEntityIds);
      for (const row of invoiceRows ?? []) {
        invoiceNumbers.set(row.id, row.invoice_number);
      }
    }
    if (quoteEntityIds.length > 0) {
      const { data: quoteRows } = await supabase
        .from("quotes")
        .select("id, version")
        .in("id", quoteEntityIds);
      for (const row of quoteRows ?? []) {
        quoteVersions.set(row.id, Number(row.version ?? 1));
      }
    }

    const items = rows.map((row) => ({
      id: row.id,
      actor: row.actor_id
        ? actorNames.get(row.actor_id) ?? `User ${row.actor_id.slice(0, 8)}`
        : "System",
      action: formatActionLabel(row.action),
      entity: formatEntity(row.entity_type, row.entity_id, entityRefs),
      timestamp: formatTimestamp(row.created_at),
    }));

    activity =
      items.length === 0
        ? { status: "empty", data: [] }
        : { status: "ok", data: items };
  }

  return {
    metrics: [
      metricFromCount(
        "leads-today",
        "New leads today",
        "Project requests submitted since 00:00 UTC.",
        leadsState,
      ),
      metricFromCount(
        "active-projects",
        "Active projects",
        "Projects that are not completed or cancelled.",
        projectsState,
      ),
      {
        id: "open-invoices",
        label: "Pending / overdue invoices",
        value:
          invoiceAmountState.status === "ok" || invoiceAmountState.status === "empty"
            ? formatMoneyList(invoiceAmountState.data)
            : "—",
        description: "Outstanding amount_due on issued, partially paid, and overdue invoices.",
        state:
          invoiceAmountState.status === "empty" ? "ok" : invoiceAmountState.status,
        message:
          invoiceAmountState.status === "unavailable" ||
          invoiceAmountState.status === "error"
            ? invoiceAmountState.message
            : undefined,
      },
      {
        id: "month-revenue",
        label: "Revenue this month",
        value:
          revenueState.status === "ok" || revenueState.status === "empty"
            ? formatMoneyList(revenueState.data)
            : "—",
        description: "Succeeded payments with paid_at in the current UTC month.",
        state: revenueState.status === "empty" ? "ok" : revenueState.status,
        message:
          revenueState.status === "unavailable" || revenueState.status === "error"
            ? revenueState.message
            : undefined,
      },
    ],
    actions: [
      actionFromCount(
        "quotes",
        "Quotes needing action",
        "Draft or expired quotes that still need admin follow-up.",
        quotesState,
      ),
      actionFromCount(
        "overdue-invoices",
        "Overdue invoices",
        "Invoices currently marked overdue.",
        overdueCountState,
      ),
      actionFromCount(
        "unread-messages",
        "Unread client messages",
        "Unread project messages not sent by you.",
        messagesState,
      ),
      actionFromCount(
        "referral-rewards",
        "Referral rewards",
        "Rewards still pending admin action.",
        rewardsState,
      ),
    ],
    activity,
  };
}
