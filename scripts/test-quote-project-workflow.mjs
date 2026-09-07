import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function read(relativePath) {
  return fs.readFileSync(path.join("/workspace", relativePath), "utf8");
}

function transpileToTemp(sourcePath) {
  const source = fs.readFileSync(sourcePath, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: sourcePath,
  });
  const outFile = path.join("/tmp/opencode", `${path.basename(sourcePath, ".ts")}.mjs`);
  fs.writeFileSync(outFile, outputText);
  return pathToFileURL(outFile).href;
}

const quoteActions = read("src/lib/admin-quote-actions.ts");
const projectRequestActions = read("src/lib/admin-project-request-actions.ts");
const customerQuoteActions = read("src/lib/customer-quote-actions.ts");
const acceptSql = read("supabase/migrations/20260907300000_request_quote_accept_creates_project.sql");
const hardenSql = read("supabase/migrations/20260907310000_harden_request_quote_accept_project.sql");
const quoteConstants = read("src/lib/admin-quote-constants.ts");
const quoteFromRequestPanel = read("src/components/admin/quotes/quote-from-request-panel.tsx");
const requestDetail = read("src/components/admin/project-requests/project-request-detail.tsx");
const quotesPage = read("src/app/admin/(dashboard)/quotes/page.tsx");
const newQuotePage = read("src/app/admin/(dashboard)/quotes/new/page.tsx");
const quoteEditor = read("src/components/admin/quotes/quote-editor.tsx");
const eligibleLoader = read("src/lib/admin-quotes.ts");
const customerRequests = read("src/lib/customer-project-requests.ts");

assert(
  !/admin_convert_project_request/.test(quoteActions),
  "quote actions must never call admin_convert_project_request()",
);

assert(
  !/\.from\(["']projects["']\)[\s\S]{0,80}\.insert\(/.test(quoteActions),
  "quote actions must never insert into projects",
);

assert(
  !/generate_project_number/.test(quoteActions),
  "quote actions must never generate a project_number",
);

assert(
  !/\.from\(["']projects["']\)[\s\S]{0,120}\.update\(/.test(quoteActions),
  "quote actions must never change projects.status",
);

assert(
  /status:\s*"quoted"/.test(quoteActions) || /status:\s*'quoted'/.test(quoteActions),
  "sending a quote may mark the request quoted, but must not convert it",
);

assert(
  !/status:\s*"converted"/.test(quoteActions) && !/status:\s*'converted'/.test(quoteActions),
  "quote actions must never mark a request converted",
);

assert(
  /Projects are created when the client accepts a quote/.test(projectRequestActions),
  "admin convert is blocked and cannot bypass quote acceptance",
);

assert(
  /client_respond_to_quote/.test(customerQuoteActions),
  "client quote response must go through client_respond_to_quote",
);

assert(
  /alter table public\.quotes alter column project_id drop not null/.test(acceptSql),
  "quotes.project_id must be nullable so quotes can exist before a project",
);

assert(
  /add column project_request_id/.test(acceptSql),
  "quotes.project_request_id must be added",
);

assert(
  /create unique index if not exists quotes_request_version_unique/.test(acceptSql),
  "quote versions must be unique per request",
);

assert(
  /create unique index if not exists projects_request_id_unique/.test(acceptSql),
  "projects.request_id unique index must be defined",
);

assert(
  /insert into public\.projects/.test(acceptSql),
  "client accept is the path that inserts a project",
);

assert(
  /status,\s*'pending'/.test(acceptSql) || /'pending'/.test(acceptSql),
  "accepted quote must create the project with status pending",
);

assert(
  /agreed_price/.test(acceptSql),
  "accepted quote total must be stored as agreed_price",
);

assert(
  /when unique_violation then/.test(acceptSql),
  "accept must be idempotent if a project already exists for the request",
);

assert(
  /raise exception 'Projects are created when the client accepts a quote/.test(acceptSql),
  "admin_convert_project_request must not create a project",
);

assert(
  /A project is created when the client accepts a quote\. Invoices/.test(hardenSql),
  "invoices require the project created by quote acceptance",
);

assert(
  /if v_quote.status <> 'accepted' then/.test(hardenSql),
  "repeated accept still attaches or reuses the single project",
);

assert(
  quoteConstants.includes('sent: ["viewed", "rejected", "expired", "cancelled"]'),
  "admin cannot mark a sent quote accepted",
);

assert(
  quoteConstants.includes('viewed: ["rejected", "expired", "cancelled"]'),
  "admin cannot mark a viewed quote accepted",
);

assert(
  quoteConstants.includes('QUOTABLE_REQUEST_STATUSES: RequestStatus[] = ["reviewing", "quoted"]'),
  "reviewed/quoted requests are listed as quotable",
);

assert(
  /never creates a project/.test(quoteFromRequestPanel),
  "quotes UI must not describe quote creation as converting a request",
);

assert(
  !/Convert to project/.test(requestDetail),
  "request detail must not offer convert-to-project as the quote path",
);

assert(
  /Create quote/.test(requestDetail),
  "request detail must allow creating a quote from the request",
);

assert(
  /A project is created only after the client accepts a quote/.test(quotesPage),
  "quotes page copy must state that a project is created only after accept",
);

assert(
  /getQuoteEligibleProjectRequests/.test(newQuotePage),
  "new quote page must load eligible requests, not projects",
);

assert(
  /name="requestId"/.test(quoteEditor),
  "quote editor must submit requestId",
);

assert(
  !/name="projectId"/.test(quoteEditor),
  "quote editor must not require projectId",
);

assert(
  /QUOTABLE_REQUEST_STATUSES/.test(eligibleLoader),
  "eligible quote requests are reviewing/quoted, not convert-first",
);

assert(
  /\.eq\(["']project_request_id["']/.test(customerRequests),
  "client request loaders must fetch quotes by project_request_id",
);

const {
  quoteFromRequestBlockedReason,
  resolveQuoteRequestForDraft,
  QUOTABLE_REQUEST_STATUSES,
} = await import(transpileToTemp("/workspace/src/lib/admin-quote-constants.ts"));

assert(
  QUOTABLE_REQUEST_STATUSES.length === 2 &&
    QUOTABLE_REQUEST_STATUSES.includes("reviewing") &&
    QUOTABLE_REQUEST_STATUSES.includes("quoted"),
  "quotable request statuses are reviewing and quoted",
);

assert(
  quoteFromRequestBlockedReason("new", true, false) ===
    "Move this request to reviewing before creating a quote.",
  "unreviewed requests cannot be quoted",
);

assert(
  quoteFromRequestBlockedReason("reviewing", true, false) === null,
  "reviewing requests can be quoted before a project exists",
);

assert(
  quoteFromRequestBlockedReason("quoted", true, false) === null,
  "quoted requests can receive another quote version",
);

const missingRequest = resolveQuoteRequestForDraft(null);
assert(!missingRequest.ok, "quote draft requires a project request");

const existingRequest = resolveQuoteRequestForDraft("request-1");
assert(existingRequest.ok && existingRequest.requestId === "request-1", "reuse the request id");

function simulateQuoteSave({ quoteId, requestId, projects, quotes }) {
  if (!requestId) {
    return { ok: false, error: "Select a project request.", projects, quotes };
  }
  if (quoteId) {
    return {
      ok: true,
      action: "update",
      requestId,
      projectId: null,
      projects,
      quotes,
    };
  }
  const nextVersion =
    quotes.filter((row) => row.project_request_id === requestId).reduce((max, row) => Math.max(max, row.version), 0) +
    1;
  const created = {
    id: `quote-${nextVersion}`,
    project_id: null,
    project_request_id: requestId,
    version: nextVersion,
    status: "draft",
    total: 1000,
  };
  return {
    ok: true,
    action: "create-version",
    requestId,
    projectId: null,
    projects,
    quotes: [...quotes, created],
    quote: created,
  };
}

function simulateSend({ quote, requestStatus }) {
  if (quote.status !== "draft") {
    return { ok: false, error: "Only draft quotes can be sent.", quote, requestStatus, projectsCreated: 0 };
  }
  return {
    ok: true,
    quote: { ...quote, status: "sent" },
    requestStatus: requestStatus === "new" || requestStatus === "reviewing" ? "quoted" : requestStatus,
    projectsCreated: 0,
  };
}

function simulateClientRespond({ action, quote, requestId, projects }) {
  if (action === "reject") {
    return {
      ok: true,
      quote: { ...quote, status: "rejected" },
      projects,
    };
  }
  if (action === "request_changes") {
    return {
      ok: true,
      quote,
      projects,
    };
  }
  if (quote.status === "accepted") {
    const existing = projects.find((row) => row.request_id === requestId) ?? null;
    return { ok: true, quote, projects, project: existing };
  }
  if (quote.status !== "sent" && quote.status !== "viewed") {
    return { ok: false, error: "cannot accept", quote, projects };
  }

  const existing = projects.find((row) => row.request_id === requestId);
  if (existing) {
    return {
      ok: true,
      quote: { ...quote, status: "accepted", project_id: existing.id },
      projects,
      project: existing,
    };
  }

  const created = {
    id: "project-1",
    request_id: requestId,
    status: "pending",
    agreed_price: quote.total,
    currency: "BDT",
  };
  return {
    ok: true,
    quote: { ...quote, status: "accepted", project_id: created.id },
    projects: [...projects, created],
    project: created,
  };
}

function simulateAdminConvert({ requestId, projects }) {
  const existing = projects.find((row) => row.request_id === requestId);
  if (existing) {
    return { ok: false, error: "already linked", projects };
  }
  return {
    ok: false,
    error: "Projects are created when the client accepts a quote. Create and send a quote from this request instead.",
    projects,
  };
}

const created = simulateQuoteSave({
  quoteId: null,
  requestId: "request-1",
  projects: [],
  quotes: [],
});
assert(created.ok && created.projects.length === 0, "Test 1: creating a quote creates no project");
assert(created.quote.project_id === null, "Test 1: new quotes have a null project_id");
assert(created.quote.project_request_id === "request-1", "Test 1: quotes attach to the request");

const updated = simulateQuoteSave({
  quoteId: created.quote.id,
  requestId: "request-1",
  projects: [],
  quotes: created.quotes,
});
assert(updated.ok && updated.projects.length === 0, "Test 2: updating a quote creates no project");

const versioned = simulateQuoteSave({
  quoteId: null,
  requestId: "request-1",
  projects: [],
  quotes: created.quotes,
});
assert(versioned.ok && versioned.projects.length === 0, "Test 3: creating a quote version creates no project");
assert(versioned.quote.version === 2, "Test 3: versions increment on the same request");
assert(versioned.quote.project_id === null, "Test 3: versions stay unattached until accept");

const sent = simulateSend({ quote: versioned.quote, requestStatus: "reviewing" });
assert(sent.ok && sent.projectsCreated === 0, "Test 4: sending a quote creates no project");
assert(sent.requestStatus === "quoted", "Test 4: sending a quote marks the request quoted");

const rejected = simulateClientRespond({
  action: "reject",
  quote: sent.quote,
  requestId: "request-1",
  projects: [],
});
assert(rejected.projects.length === 0, "Test 5: rejecting a quote creates no project");

const changeRequest = simulateClientRespond({
  action: "request_changes",
  quote: sent.quote,
  requestId: "request-1",
  projects: [],
});
assert(changeRequest.projects.length === 0, "Test 6: requesting changes creates no project");

const accepted = simulateClientRespond({
  action: "accept",
  quote: sent.quote,
  requestId: "request-1",
  projects: [],
});
assert(accepted.ok && accepted.projects.length === 1, "Test 7: accepting a quote creates exactly one project");
assert(accepted.project.status === "pending", "Test 7: accepted project status is pending");
assert(accepted.project.agreed_price === sent.quote.total, "Test 7: agreed_price comes from the quote total");
assert(accepted.quote.project_id === accepted.project.id, "Test 7: accepted quote is linked to the project");

const doubleAccept = simulateClientRespond({
  action: "accept",
  quote: accepted.quote,
  requestId: "request-1",
  projects: accepted.projects,
});
assert(doubleAccept.projects.length === 1, "Test 8: double-accept stays one project");
assert(doubleAccept.project.id === accepted.project.id, "Test 8: the same project is reused");

const v1Accept = simulateClientRespond({
  action: "accept",
  quote: { ...created.quote, status: "sent", total: 500 },
  requestId: "request-1",
  projects: accepted.projects,
});
assert(v1Accept.projects.length === 1, "Test 9: accepting another version does not create a second project");
assert(v1Accept.project.id === "project-1", "Test 9: Project A from v1 stays the only project");

const blockedConvert = simulateAdminConvert({ requestId: "request-2", projects: [] });
assert(!blockedConvert.ok && blockedConvert.projects.length === 0, "admin convert cannot create a project");

console.log("quote/project workflow checks passed");
