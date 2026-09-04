import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

function transpileToTemp(sourcePath) {
  const source = fs.readFileSync(sourcePath, "utf8");
  let { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: sourcePath,
  });
  outputText = outputText.replace(/from ["']@\/types\/database["'];?/g, "");
  const outFile = path.join(
    "/tmp/opencode",
    `${path.basename(sourcePath, ".ts")}.mjs`,
  );
  fs.writeFileSync(outFile, outputText);
  return pathToFileURL(outFile).href;
}

const { decideAdminAccess } = await import(
  transpileToTemp("/workspace/src/lib/admin-access.ts")
);
const {
  isAdminPath,
  isAdminLoginPath,
  isProtectedAdminPath,
  getLoginRedirectPath,
  getAdminLoginRedirectPath,
  getSafeNextPath,
  getSafeAdminNextPath,
} = await import(transpileToTemp("/workspace/src/lib/auth.ts"));

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(isAdminPath("/admin"), "/admin is an admin route");
assert(isAdminPath("/admin/projects/abc"), "nested admin routes are admin paths");
assert(isAdminLoginPath("/admin/login"), "/admin/login is the admin login page");
assert(!isProtectedAdminPath("/admin/login"), "/admin/login is not a protected dashboard route");
assert(isProtectedAdminPath("/admin"), "/admin dashboard is protected");
assert(isProtectedAdminPath("/admin/quotes/new"), "nested dashboard routes are protected");
assert(!isAdminPath("/start-project"), "public /start-project stays public");
assert(!isAdminPath("/profile"), "customer profile is not an admin route");
assert(!isAdminPath("/login"), "client login is not an admin route");

assert(
  decideAdminAccess({
    hasUser: false,
    isAdminRpc: null,
    rpcError: false,
    profile: null,
  }) === "unauthenticated",
  "unauthenticated access to /admin is denied",
);

assert(
  decideAdminAccess({
    hasUser: true,
    isAdminRpc: false,
    rpcError: false,
    profile: {
      full_name: "Client User",
      display_name: "Client",
      role: "client",
      status: "active",
    },
  }) === "forbidden",
  "authenticated non-admin access is denied",
);

assert(
  decideAdminAccess({
    hasUser: true,
    isAdminRpc: true,
    rpcError: false,
    profile: {
      full_name: "Admin User",
      display_name: "Admin",
      role: "admin",
      status: "active",
    },
  }) === "allow",
  "authenticated admin access is allowed",
);

assert(
  getLoginRedirectPath("/profile") === "/login?next=%2Fprofile",
  "clients are sent to the customer login page",
);

assert(
  getSafeNextPath("/admin") === "/profile",
  "client login cannot target the admin dashboard",
);

assert(
  getSafeNextPath("/admin/quotes/new") === "/profile",
  "client OAuth/login cannot land on nested admin routes",
);

assert(
  getAdminLoginRedirectPath("/admin") === "/admin/login?next=%2Fadmin",
  "unauthenticated users are sent to the dedicated admin login page",
);

assert(
  getAdminLoginRedirectPath("/admin/projects/1") ===
    "/admin/login?next=%2Fadmin%2Fprojects%2F1",
  "admin login preserves nested dashboard destinations",
);

assert(
  getSafeAdminNextPath("/login") === "/admin",
  "admin login ignores non-admin next paths",
);

assert(
  getSafeAdminNextPath("/admin/login") === "/admin",
  "admin login does not loop back onto itself",
);

console.log("admin guard tests passed");
