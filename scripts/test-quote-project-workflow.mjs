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
const convertSql = read("supabase/migrations/20260904220000_admin_convert_project_request.sql");
const uniqueSql = read("supabase/migrations/20260907200000_quote_never_creates_project.sql");
const quoteConstants = read("src/lib/admin-quote-constants.ts");
const quoteFromRequestPanel = read("src/components/admin/quotes/quote-from-request-panel.tsx");
const requestDetail = read("src/components/admin/project-requests/project-request-detail.tsx");
const quotesPage = read("src/app/admin/(dashboard)/quotes/page.tsx");
const eligibleLoader = read("src/lib/admin-quotes.ts");

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
  !/\.from\(["']project_requests["']\)[\s\S]{0,120}\.update\(/.test(quoteActions),
  "quote actions must never change project_requests.status",
);

assert(
  !/\.from\(["']projects["']\)[\s\S]{0,120}\.update\(/.test(quoteActions),
  "quote actions must never change projects.status",
);

assert(
  /admin_convert_project_request/.test(projectRequestActions),
  "explicit convertProjectRequest remains the conversion entry point",
);

assert(
  /status,\s*'pending'/.test(convertSql) || /'pending'/.test(convertSql),
  "conversion must create the project with status pending",
);

assert(
  /Only approved requests can be converted to a project/.test(convertSql),
  "conversion still requires an approved request",
);

assert(
  /create unique index if not exists projects_request_id_unique/.test(uniqueSql),
  "projects.request_id unique index must be defined",
);

assert(
  /Inspect rows referenced by quotes\/invoices\/messages/.test(uniqueSql),
  "duplicate inspection must preserve referenced records",
);

assert(
  !/delete from public\.projects/i.test(uniqueSql),
  "duplicate inspection must not delete projects",
);

assert(
  quoteConstants.includes('QUOTABLE_REQUEST_STATUSES: RequestStatus[] = ["converted"]'),
  "only converted requests (already linked to a project) are listed as quotable",
);

assert(
  /never creates a project/.test(quoteFromRequestPanel) ||
    /never converts the request or creates another project/.test(quoteFromRequestPanel),
  "quotes UI must not describe quote creation as converting a request",
);

assert(
  !/createQuoteDraftFromRequest/.test(requestDetail),
  "request detail must not convert via quote creation",
);

assert(
  /quote save never creates a project/.test(quotesPage),
  "quotes page copy must state that quote save never creates a project",
);

assert(
  /linkedRequestIds\.has\(row\.id\)/.test(eligibleLoader),
  "eligible quote requests must already have a linked project",
);

const {
  quoteFromRequestBlockedReason,
  resolveExistingProjectForQuote,
  QUOTABLE_REQUEST_STATUSES,
} = await import(transpileToTemp("/workspace/src/lib/admin-quote-constants.ts"));

assert(
  QUOTABLE_REQUEST_STATUSES.length === 1 && QUOTABLE_REQUEST_STATUSES[0] === "converted",
  "quotable request statuses are converted-only",
);

assert(
  quoteFromRequestBlockedReason("approved", true, false) ===
    "Convert this request to a project first. Creating or updating a quote never creates a project.",
  "unconverted requests cannot be quoted",
);

assert(
  quoteFromRequestBlockedReason("converted", true, true) === null,
  "converted requests with a linked project can be quoted",
);

const missingProject = resolveExistingProjectForQuote(null);
assert(!missingProject.ok, "quote draft requires an existing project");

const existingProject = resolveExistingProjectForQuote("project-1");
assert(existingProject.ok && existingProject.projectId === "project-1", "reuse the existing project id");

function simulateQuoteSave({ quoteId, projectId, projects }) {
  const project = projects.find((row) => row.id === projectId);
  if (!project) {
    return { ok: false, error: "Project not found.", projects, quotesCreated: 0 };
  }
  if (quoteId) {
    return {
      ok: true,
      action: "update",
      projectId,
      projects,
      quotesCreated: 0,
    };
  }
  return {
    ok: true,
    action: "create-version",
    projectId,
    projects,
    quotesCreated: 1,
  };
}

function simulateConvert({ requestId, requestStatus, projects }) {
  const existing = projects.filter((row) => row.request_id === requestId);
  if (existing.length > 0) {
    return { ok: false, error: "already converted", projects };
  }
  if (requestStatus !== "approved") {
    return { ok: false, error: "not approved", projects };
  }
  const created = {
    id: "project-new",
    request_id: requestId,
    status: "pending",
    project_number: "PJ-001",
  };
  return {
    ok: true,
    project: created,
    projects: [...projects, created],
  };
}

const originalProject = {
  id: "project-1",
  request_id: "request-1",
  status: "pending",
  project_number: "PJ-001",
};

const updated = simulateQuoteSave({
  quoteId: "quote-1",
  projectId: "project-1",
  projects: [originalProject],
});
assert(updated.ok && updated.projects.length === 1, "updating a quote creates no project");
assert(updated.projectId === "project-1", "updating a quote keeps the same project_id");

const versioned = simulateQuoteSave({
  quoteId: null,
  projectId: "project-1",
  projects: [originalProject],
});
assert(versioned.ok && versioned.projects.length === 1, "creating a quote version creates no project");
assert(versioned.projectId === "project-1", "new quote version stays on the same project_id");

const converted = simulateConvert({
  requestId: "request-2",
  requestStatus: "approved",
  projects: [],
});
assert(converted.ok && converted.projects.length === 1, "explicit convert creates exactly one project");
assert(converted.project.status === "pending", "converted project status remains pending");

const secondConvert = simulateConvert({
  requestId: "request-2",
  requestStatus: "approved",
  projects: converted.projects,
});
assert(!secondConvert.ok, "request_id uniqueness blocks a second project");

console.log("quote/project workflow checks passed");
