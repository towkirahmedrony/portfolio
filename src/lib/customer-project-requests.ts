import {
  canClientCancelRequest,
  canClientEditRequest,
  isClientResubmitStatus,
} from "@/lib/admin-project-request-constants";
import {
  canClientAcceptQuote,
  canClientRejectQuote,
  canClientRequestQuoteChanges,
} from "@/lib/admin-quote-constants";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type {
  InvoiceRow,
  ProjectRequestRow,
  ProjectRow,
  ProjectStatus,
  QuoteItemRow,
  QuoteRow,
  QuoteStatus,
  RequestStatus,
} from "@/types/database";

const REQUEST_COLUMNS =
  "id, request_number, client_id, full_name, email, phone, company_name, project_type, website_status, page_count, description, required_features, has_design, figma_url, reference_urls, design_style, has_logo, has_brand_colors, brand_colors, budget_min, budget_max, budget_currency, deadline_type, deadline_date, referral_code_entered, referral_code_id, source, status, service_id, form_snapshot, submitted_at, updated_at, last_activity_at";

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
  | "updated_at"
>;

type LinkedQuoteRow = Pick<
  QuoteRow,
  | "id"
  | "project_id"
  | "version"
  | "currency"
  | "subtotal"
  | "discount_total"
  | "tax_total"
  | "total"
  | "status"
  | "notes"
  | "terms"
  | "valid_until"
  | "sent_at"
  | "accepted_at"
  | "rejected_at"
  | "created_at"
  | "updated_at"
>;

const QUOTE_COLUMNS =
  "id, project_id, version, currency, subtotal, discount_total, tax_total, total, status, notes, terms, valid_until, sent_at, accepted_at, rejected_at, created_at, updated_at";

const PROJECT_COLUMNS =
  "id, project_number, request_id, client_id, title, status, agreed_price, estimated_budget, currency, due_date, updated_at";

export type CustomerLinkedProject = {
  id: string;
  project_number: string;
  title: string;
  status: ProjectStatus;
  agreed_price: number | null;
  estimated_budget: number | null;
  currency: string;
  due_date: string | null;
  updated_at: string;
};

export type CustomerInvoiceSummary = Pick<
  InvoiceRow,
  "id" | "invoice_number" | "status" | "total" | "amount_paid" | "amount_due" | "currency" | "quote_id"
>;

export type CustomerRequestQuote = {
  id: string;
  version: number;
  currency: string;
  subtotal: number;
  discount_total: number;
  tax_total: number;
  total: number;
  status: QuoteStatus;
  notes: string | null;
  terms: string | null;
  valid_until: string | null;
  sent_at: string | null;
  accepted_at: string | null;
  rejected_at: string | null;
  created_at: string;
  updated_at: string;
  canAccept: boolean;
  canReject: boolean;
  canRequestChanges: boolean;
};

export type CustomerRequestFile = {
  id: string;
  original_name: string;
  category: string;
  file_size_bytes: number | null;
  created_at: string;
  bucket_name: string;
  storage_path: string;
  uploaded_by?: string | null;
};

export type CustomerProjectRequestItem = {
  request: ProjectRequestRow;
  linkedProject: CustomerLinkedProject | null;
  quote: CustomerRequestQuote | null;
  canCancel: boolean;
  canEdit: boolean;
  canResubmit: boolean;
};

export type CustomerProjectRequestDetail = CustomerProjectRequestItem & {
  serviceName: string | null;
  files: CustomerRequestFile[];
  quoteItems: QuoteItemRow[];
  invoices: CustomerInvoiceSummary[];
};

const CLIENT_VISIBLE_QUOTE_STATUSES: QuoteStatus[] = [
  "sent",
  "viewed",
  "accepted",
  "rejected",
  "expired",
];

function toLinkedProject(row: LinkedProjectRow): CustomerLinkedProject {
  return {
    id: row.id,
    project_number: row.project_number,
    title: row.title,
    status: row.status,
    agreed_price: row.agreed_price,
    estimated_budget: row.estimated_budget,
    currency: row.currency || "BDT",
    due_date: row.due_date,
    updated_at: row.updated_at,
  };
}

function toCustomerQuote(quote: LinkedQuoteRow): CustomerRequestQuote {
  return {
    id: quote.id,
    version: quote.version,
    currency: quote.currency || "BDT",
    subtotal: Number(quote.subtotal ?? 0),
    discount_total: Number(quote.discount_total ?? 0),
    tax_total: Number(quote.tax_total ?? 0),
    total: Number(quote.total ?? 0),
    status: quote.status,
    notes: quote.notes,
    terms: quote.terms,
    valid_until: quote.valid_until,
    sent_at: quote.sent_at,
    accepted_at: quote.accepted_at,
    rejected_at: quote.rejected_at,
    created_at: quote.created_at,
    updated_at: quote.updated_at,
    canAccept: canClientAcceptQuote(quote.status, quote.valid_until),
    canReject: canClientRejectQuote(quote.status),
    canRequestChanges: canClientRequestQuoteChanges(quote.status),
  };
}

function pickLatestQuote(quotes: LinkedQuoteRow[]): CustomerRequestQuote | null {
  const visible = quotes.filter((quote) =>
    CLIENT_VISIBLE_QUOTE_STATUSES.includes(quote.status),
  );
  if (visible.length === 0) {
    return null;
  }

  const latest = [...visible].sort((a, b) => {
    if (b.version !== a.version) {
      return b.version - a.version;
    }
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  })[0];

  return toCustomerQuote(latest);
}

export async function getCustomerProjectRequests(
  userId: string,
): Promise<CustomerProjectRequestItem[]> {
  const supabase = await createServerSupabaseClient();

  let requestResult = (await supabase
    .from("project_requests")
    .select(REQUEST_COLUMNS)
    .eq("client_id", userId)
    .order("submitted_at", { ascending: false })) as {
    data: ProjectRequestRow[] | null;
    error: { message?: string; code?: string } | null;
  };

  if (requestResult.error && isMissingColumn(requestResult.error)) {
    requestResult = (await supabase
      .from("project_requests")
      .select(REQUEST_COLUMNS_CORE)
      .eq("client_id", userId)
      .order("submitted_at", { ascending: false })) as {
      data: ProjectRequestRow[] | null;
      error: { message?: string; code?: string } | null;
    };
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
    .select(PROJECT_COLUMNS)
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
      .select(QUOTE_COLUMNS)
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

  return requests.map((request) => toCustomerItem(request, projectsByRequestId, quotesByProjectId));
}

function toCustomerItem(
  request: ProjectRequestRow,
  projectsByRequestId: Map<string, LinkedProjectRow>,
  quotesByProjectId: Map<string, LinkedQuoteRow[]>,
): CustomerProjectRequestItem {
  const linked = projectsByRequestId.get(request.id) ?? null;
  const quote = linked ? pickLatestQuote(quotesByProjectId.get(linked.id) ?? []) : null;
  const locked = Boolean(linked);
  return {
    request,
    linkedProject: linked ? toLinkedProject(linked) : null,
    quote,
    canCancel: canClientCancelRequest(request.status as RequestStatus) && !locked,
    canEdit: canClientEditRequest(request.status as RequestStatus) && !locked,
    canResubmit: isClientResubmitStatus(request.status as RequestStatus) && !locked,
  };
}

export async function getCustomerProjectRequest(
  userId: string,
  requestId: string,
): Promise<CustomerProjectRequestDetail | null> {
  const supabase = await createServerSupabaseClient();

  let requestResult = (await supabase
    .from("project_requests")
    .select(REQUEST_COLUMNS)
    .eq("id", requestId)
    .eq("client_id", userId)
    .maybeSingle()) as {
    data: ProjectRequestRow | null;
    error: { message?: string; code?: string } | null;
  };

  if (requestResult.error && isMissingColumn(requestResult.error)) {
    requestResult = (await supabase
      .from("project_requests")
      .select(REQUEST_COLUMNS_CORE)
      .eq("id", requestId)
      .eq("client_id", userId)
      .maybeSingle()) as {
      data: ProjectRequestRow | null;
      error: { message?: string; code?: string } | null;
    };
  }

  if (requestResult.error) {
    console.error(
      "customer project_request detail query failed:",
      requestResult.error.message,
    );
    return null;
  }

  const request = requestResult.data as ProjectRequestRow | null;
  if (!request || request.client_id !== userId) {
    return null;
  }

  const { data: projectRows } = await supabase
    .from("projects")
    .select(PROJECT_COLUMNS)
    .eq("request_id", request.id)
    .eq("client_id", userId)
    .order("created_at", { ascending: true })
    .limit(1);

  const linked = (projectRows?.[0] ?? null) as LinkedProjectRow | null;
  const projectsByRequestId = new Map<string, LinkedProjectRow>();
  const quotesByProjectId = new Map<string, LinkedQuoteRow[]>();
  let quoteItems: QuoteItemRow[] = [];
  let invoices: CustomerInvoiceSummary[] = [];

  if (linked) {
    projectsByRequestId.set(request.id, linked);
    const { data: quoteRows } = await supabase
      .from("quotes")
      .select(QUOTE_COLUMNS)
      .eq("project_id", linked.id)
      .order("version", { ascending: false });

    quotesByProjectId.set(linked.id, (quoteRows ?? []) as LinkedQuoteRow[]);

    const latestQuote = pickLatestQuote((quoteRows ?? []) as LinkedQuoteRow[]);
    if (latestQuote) {
      const { data: itemRows, error: itemError } = await supabase
        .from("quote_items")
        .select("*")
        .eq("quote_id", latestQuote.id)
        .order("sort_order", { ascending: true });
      if (!itemError) {
        quoteItems = (itemRows ?? []) as QuoteItemRow[];
      }
    }

    const { data: invoiceRows } = await supabase
      .from("invoices")
      .select("id, invoice_number, status, total, amount_paid, amount_due, currency, quote_id")
      .eq("project_id", linked.id)
      .eq("client_id", userId)
      .order("created_at", { ascending: false });
    invoices = (invoiceRows ?? []) as CustomerInvoiceSummary[];
  }

  let serviceName: string | null = null;
  if (request.service_id) {
    const { data: service } = await supabase
      .from("services")
      .select("id, name")
      .eq("id", request.service_id)
      .maybeSingle();
    serviceName = service?.name ?? null;
  }

  const files: CustomerRequestFile[] = [];
  const { data: requestFileRows, error: requestFileError } = await supabase
    .from("project_files")
    .select("id, original_name, category, file_size_bytes, created_at, bucket_name, storage_path, uploaded_by")
    .eq("project_request_id", request.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (!requestFileError) {
    for (const file of requestFileRows ?? []) {
      files.push({
        id: file.id,
        original_name: file.original_name,
        category: file.category,
        file_size_bytes: file.file_size_bytes,
        created_at: file.created_at,
        bucket_name: file.bucket_name,
        storage_path: file.storage_path,
        uploaded_by: file.uploaded_by,
      });
    }
  }

  if (linked && files.length === 0) {
    const { data: fileRows } = await supabase
      .from("project_files")
      .select("id, original_name, category, file_size_bytes, created_at, bucket_name, storage_path")
      .eq("project_id", linked.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    for (const file of fileRows ?? []) {
      files.push({
        id: file.id,
        original_name: file.original_name,
        category: file.category,
        file_size_bytes: file.file_size_bytes,
        created_at: file.created_at,
        bucket_name: file.bucket_name,
        storage_path: file.storage_path,
      });
    }
  }

  return {
    ...toCustomerItem(request, projectsByRequestId, quotesByProjectId),
    serviceName,
    files,
    quoteItems,
    invoices,
  };
}

export type CustomerProjectDetail = {
  project: ProjectRow;
  request: ProjectRequestRow | null;
  quote: CustomerRequestQuote | null;
  quoteItems: QuoteItemRow[];
  invoices: CustomerInvoiceSummary[];
};

export async function getCustomerProjectDetail(
  userId: string,
  projectId: string,
): Promise<CustomerProjectDetail | null> {
  const supabase = await createServerSupabaseClient();
  const { data: project, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("client_id", userId)
    .maybeSingle();

  if (error || !project || project.client_id !== userId) {
    return null;
  }

  let request: ProjectRequestRow | null = null;
  if (project.request_id) {
    let requestResult = (await supabase
      .from("project_requests")
      .select(REQUEST_COLUMNS)
      .eq("id", project.request_id)
      .eq("client_id", userId)
      .maybeSingle()) as {
      data: ProjectRequestRow | null;
      error: { message?: string; code?: string } | null;
    };

    if (requestResult.error && isMissingColumn(requestResult.error)) {
      requestResult = (await supabase
        .from("project_requests")
        .select(REQUEST_COLUMNS_CORE)
        .eq("id", project.request_id)
        .eq("client_id", userId)
        .maybeSingle()) as {
        data: ProjectRequestRow | null;
        error: { message?: string; code?: string } | null;
      };
    }

    request = requestResult.data;
  }

  const { data: quoteRows } = await supabase
    .from("quotes")
    .select(QUOTE_COLUMNS)
    .eq("project_id", project.id)
    .order("version", { ascending: false });

  const quote = pickLatestQuote((quoteRows ?? []) as LinkedQuoteRow[]);
  let quoteItems: QuoteItemRow[] = [];
  if (quote) {
    const { data: itemRows, error: itemError } = await supabase
      .from("quote_items")
      .select("*")
      .eq("quote_id", quote.id)
      .order("sort_order", { ascending: true });
    if (!itemError) {
      quoteItems = (itemRows ?? []) as QuoteItemRow[];
    }
  }

  const { data: invoiceRows } = await supabase
    .from("invoices")
    .select("id, invoice_number, status, total, amount_paid, amount_due, currency, quote_id")
    .eq("project_id", project.id)
    .eq("client_id", userId)
    .order("created_at", { ascending: false });

  return {
    project: project as ProjectRow,
    request,
    quote,
    quoteItems,
    invoices: (invoiceRows ?? []) as CustomerInvoiceSummary[],
  };
}
