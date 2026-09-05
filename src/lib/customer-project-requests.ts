import { canClientCancelRequest } from "@/lib/admin-project-request-constants";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type {
  ProjectRequestRow,
  ProjectRow,
  ProjectStatus,
  QuoteRow,
  QuoteStatus,
} from "@/types/database";

const REQUEST_COLUMNS =
  "id, request_number, client_id, full_name, email, phone, company_name, project_type, website_status, page_count, description, required_features, has_design, figma_url, reference_urls, design_style, has_logo, has_brand_colors, brand_colors, budget_min, budget_max, budget_currency, deadline_type, deadline_date, referral_code_entered, referral_code_id, source, status, service_id, form_snapshot, submitted_at, updated_at";

const REQUEST_COLUMNS_CORE =
  "id, request_number, client_id, full_name, email, phone, company_name, project_type, website_status, page_count, description, required_features, has_design, figma_url, reference_urls, design_style, has_logo, has_brand_colors, brand_colors, budget_min, budget_max, budget_currency, deadline_type, deadline_date, referral_code_entered, referral_code_id, source, status, submitted_at, updated_at";

function isMissingColumn(error: { message?: string; code?: string } | null): boolean {
  if (!error) {
    return false;
  }
  const message = (error.message ?? "").toLowerCase();
  return (
    error.code === "PGRST204" ||
    error.code === "42703" ||
    message.includes("does not exist") ||
    message.includes("schema cache") ||
    message.includes("could not find the")
  );
}

type LinkedProjectRow = Pick<
  ProjectRow,
  | "id"
  | "project_number"
  | "request_id"
  | "client_id"
  | "title"
  | "status"
  | "agreed_price"
  | "estimated_budget"
  | "currency"
  | "due_date"
>;

type LinkedQuoteRow = Pick<
  QuoteRow,
  | "id"
  | "project_id"
  | "version"
  | "currency"
  | "total"
  | "status"
  | "valid_until"
  | "created_at"
>;

export type CustomerLinkedProject = {
  id: string;
  project_number: string;
  title: string;
  status: ProjectStatus;
  agreed_price: number | null;
  estimated_budget: number | null;
  currency: string;
  due_date: string | null;
};

export type CustomerRequestQuote = {
  id: string;
  version: number;
  currency: string;
  total: number;
  status: QuoteStatus;
  valid_until: string | null;
};

export type CustomerProjectRequestItem = {
  request: ProjectRequestRow;
  linkedProject: CustomerLinkedProject | null;
  quote: CustomerRequestQuote | null;
  canCancel: boolean;
};

const CLIENT_VISIBLE_QUOTE_STATUSES: QuoteStatus[] = [
  "sent",
  "viewed",
  "accepted",
];

function toLinkedProject(row: LinkedProjectRow): CustomerLinkedProject {
  return {
    id: row.id,
    project_number: row.project_number,
    title: row.title,
    status: row.status,
    agreed_price: row.agreed_price,
    estimated_budget: row.estimated_budget,
    currency: row.currency,
    due_date: row.due_date,
  };
}

function pickLatestQuote(quotes: LinkedQuoteRow[]): CustomerRequestQuote | null {
  const visible = quotes.filter((quote) =>
    CLIENT_VISIBLE_QUOTE_STATUSES.includes(quote.status),
  );
  const source = visible.length > 0 ? visible : quotes;
  if (source.length === 0) {
    return null;
  }

  const latest = [...source].sort((a, b) => {
    if (b.version !== a.version) {
      return b.version - a.version;
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  })[0];

  return {
    id: latest.id,
    version: latest.version,
    currency: latest.currency,
    total: latest.total,
    status: latest.status,
    valid_until: latest.valid_until,
  };
}

export async function getCustomerProjectRequests(
  userId: string,
): Promise<CustomerProjectRequestItem[]> {
  const supabase = await createServerSupabaseClient();

  // Added ': any' to prevent TS2322 mismatch between the two different select query outputs
  let requestResult: any = await supabase
    .from("project_requests")
    .select(REQUEST_COLUMNS)
    .eq("client_id", userId)
    .order("submitted_at", { ascending: false });

  if (requestResult.error && isMissingColumn(requestResult.error)) {
    requestResult = await supabase
      .from("project_requests")
      .select(REQUEST_COLUMNS_CORE)
      .eq("client_id", userId)
      .order("submitted_at", { ascending: false });
  }

  if (requestResult.error) {
    console.error(
      "customer project_requests query failed:",
      requestResult.error.message,
    );
    return [];
  }

  const { data: projectRows, error: projectError } = await supabase
    .from("projects")
    .select(
      "id, project_number, request_id, client_id, title, status, agreed_price, estimated_budget, currency, due_date",
    )
    .eq("client_id", userId);

  if (projectError) {
    console.error("customer projects query failed:", projectError.message);
  }

  const requests = (requestResult.data ?? []) as ProjectRequestRow[];
  const projects = (projectRows ?? []) as LinkedProjectRow[];
  const projectsByRequestId = new Map<string, LinkedProjectRow>();
  for (const project of projects) {
    if (project.request_id) {
      projectsByRequestId.set(project.request_id, project);
    }
  }

  const projectIds = projects.map((project) => project.id);
  const quotesByProjectId = new Map<string, LinkedQuoteRow[]>();
  if (projectIds.length > 0) {
    const { data: quoteRows, error: quoteError } = await supabase
      .from("quotes")
      .select("id, project_id, version, currency, total, status, valid_until, created_at")
      .in("project_id", projectIds)
      .order("version", { ascending: false });

    if (!quoteError) {
      for (const quote of (quoteRows ?? []) as LinkedQuoteRow[]) {
        const list = quotesByProjectId.get(quote.project_id) ?? [];
        list.push(quote);
        quotesByProjectId.set(quote.project_id, list);
      }
    }
  }

  return requests.map((request) => {
    const linked = projectsByRequestId.get(request.id) ?? null;
    const quote = linked ? pickLatestQuote(quotesByProjectId.get(linked.id) ?? []) : null;
    return {
      request,
      linkedProject: linked ? toLinkedProject(linked) : null,
      quote,
      canCancel: canClientCancelRequest(request.status) && !linked,
    };
  });
}
