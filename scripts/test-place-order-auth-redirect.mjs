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

const repoRoot = path.resolve(import.meta.dirname, "..");
const { resolveCallbackReturn, persistAuthReturnTo } = await import(
  transpileToTemp(path.join(repoRoot, "src/lib/auth.ts"))
);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const SUBMIT_HASH = "#order-submit-section";
const START_PROJECT = `/start-project${SUBMIT_HASH}`;
const placeCookie = `auth-return-to=${encodeURIComponent(START_PROJECT)}; auth-return-reason=place-order`;
const profileCookie = `auth-return-to=${encodeURIComponent("/profile")}`;

function resolve({ queryNext, queryReason, cookie }) {
  const { next } = resolveCallbackReturn({
    queryNext: queryNext ?? null,
    queryReason: queryReason ?? null,
    cookieHeader: cookie ?? null,
  });
  return next;
}

// 1. OAuth/email callback with the full place-order query -> submit page.
assert(
  resolve({ queryNext: START_PROJECT, queryReason: "place-order", cookie: null }) ===
    START_PROJECT,
  "place-order query returns to the submit page",
);

// 2. Query next stripped by the provider, coherent cookies survive -> submit page.
assert(
  resolve({ queryNext: null, queryReason: null, cookie: placeCookie }) ===
    START_PROJECT,
  "cookie fallback returns to the submit page when the query is stripped",
);

// 3. Place-order flow with a service param keeps the param + submit hash.
assert(
  resolve({
    queryNext: "/start-project?service=web#order-submit-section",
    queryReason: "place-order",
    cookie: null,
  }) === "/start-project?service=web#order-submit-section",
  "place-order return keeps the original start-project query",
);

// 4. Normal login with no context keeps the default /profile destination.
assert(
  resolve({ queryNext: null, queryReason: null, cookie: null }) === "/profile",
  "normal login with no context still defaults to /profile",
);

// 5. Normal login with a default next=/profile query still lands on /profile,
//    even when a stale place-order pair is present in cookies.
assert(
  resolve({ queryNext: "/profile", queryReason: null, cookie: placeCookie }) ===
    "/profile",
  "normal login is not rerouted by stale place-order cookies",
);

// 6. Normal OAuth that was started after a normal login persists /profile and
//    clears the place-order reason (Fix A behavior asserted via cookie write).
{
  const writes = [];
  globalThis.document = {
    cookie: "",
    set cookie(value) {
      writes.push(value);
    },
  };
  persistAuthReturnTo("/profile", null);
  const reasonClear = writes.find((w) => w.startsWith("auth-return-reason="));
  assert(
    reasonClear && reasonClear.includes("Max-Age=0"),
    "normal login clears the stale place-order reason cookie",
  );
  delete globalThis.document;
}

// 7. Place-order error redirect keeps reason for the retry login page.
{
  const { placeOrder } = resolveCallbackReturn({
    queryNext: START_PROJECT,
    queryReason: "place-order",
    cookieHeader: null,
  });
  assert(placeOrder === true, "place-order context is reported for error retries");
}

console.log("place-order auth redirect tests passed");
