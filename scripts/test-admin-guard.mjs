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
const { isAdminPath, getLoginRedirectPath, getSafeNextPath } = await import(
  transpileToTemp("/workspace/src/lib/auth.ts")
);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(isAdminPath("/admin"), "1. /admin is an admin route");
assert(
  isAdminPath("/admin/projects/abc"),
  "4. nested admin routes are protected",
);
assert(!isAdminPath("/start-project"), "public /start-project stays public");
assert(!isAdminPath("/profile"), "customer profile is not an admin route");

assert(
  decideAdminAccess({
    hasUser: false,
    isAdminRpc: null,
    rpcError: false,
    profile: null,
  }) === "unauthenticated",
  "1. unauthenticated access to /admin is denied",
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
  "2. authenticated non-admin access is denied",
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
  "3. authenticated admin access is allowed",
);

assert(
  getLoginRedirectPath("/admin") === "/login?next=%2Fadmin",
  "unauthenticated users are sent to the existing login page",
);

assert(
  getSafeNextPath("/admin/quotes/new") === "/admin/quotes/new",
  "login next path preserves nested admin routes",
);

console.log("admin guard tests passed");
