import {
  canClientCancelRequest,
  canClientEditRequest,
  isClientResubmitStatus,
} from "@/lib/admin-project-request-constants";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type {
  ProjectRequestRow,
  ProjectRow,
  ProjectStatus,
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
    currency: row.currency || "BDT",
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
    currency: latest.currency || "BDT",
    total: latest.total,
    status: latest.status,
    valid_until: latest.valid_until,
  };
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

  const { data: projectRow } = await supabase
    .from("projects")
    .select(
      "id, project_number, request_id, client_id, title, status, agreed_price, estimated_budget, currency, due_date",
    )
    .eq("request_id", request.id)
    .eq("client_id", userId)
    .maybeSingle();

  const linked = (projectRow ?? null) as LinkedProjectRow | null;
  const projectsByRequestId = new Map<string, LinkedProjectRow>();
  const quotesByProjectId = new Map<string, LinkedQuoteRow[]>();

  if (linked) {
    projectsByRequestId.set(request.id, linked);
    const { data: quoteRows } = await supabase
      .from("quotes")
      .select("id, project_id, version, currency, total, status, valid_until, created_at")
      .eq("project_id", linked.id)
      .order("version", { ascending: false });

    quotesByProjectId.set(linked.id, (quoteRows ?? []) as LinkedQuoteRow[]);
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
  };
}
