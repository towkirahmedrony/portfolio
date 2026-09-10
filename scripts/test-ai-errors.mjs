import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);

async function main() {
  const { pathToFileURL } = await import("node:url");
  const { register } = await import("node:module");

  try {
    register("ts-node/esm", pathToFileURL("./"));
  } catch {
    // Fall through to compiled-style dynamic import via jiti if available.
  }

  let errors;
  try {
    const { createJiti } = await import("jiti");
    const jiti = createJiti(import.meta.url);
    errors = await jiti.import("../src/lib/ai/errors.ts");
  } catch {
    const { createRequire: createCjsRequire } = await import("node:module");
    const cjsRequire = createCjsRequire(import.meta.url);
    try {
      errors = cjsRequire("../src/lib/ai/errors.ts");
    } catch (error) {
      console.error("Could not load errors.ts", error);
      process.exit(1);
    }
  }

  const {
    GeminiRequestError,
    AiRouteError,
    publicMessageForGemini,
    sanitizeAiLogValue,
    errorMessage,
  } = errors;

  assert.equal(
    sanitizeAiLogValue("key AIzaSyDummyKeyValue1234567890 and GEMINI_API_KEY"),
    "key [redacted] and [redacted]",
  );

  const timeout = new GeminiRequestError({
    message: "Gemini request timed out after 20000ms.",
    status: 504,
    code: "timeout",
  });
  assert.equal(
    publicMessageForGemini(timeout),
    "The assistant took too long to reply. Please try again.",
  );

  const auth = new GeminiRequestError({
    message: "Gemini API error: API key not valid",
    status: 503,
    code: "auth",
    httpStatus: 400,
  });
  assert.equal(
    publicMessageForGemini(auth),
    "The assistant is not available right now.",
  );

  const empty = new GeminiRequestError({
    message: "Gemini returned an empty reply.",
    status: 502,
    code: "empty",
  });
  assert.equal(
    publicMessageForGemini(empty),
    "The assistant returned an empty reply. Please try again.",
  );

  const route = new AiRouteError({
    message: "relation ai_chat_sessions does not exist",
    publicMessage: "Could not start that conversation. Please try again.",
    status: 500,
    stage: "request.create-session",
    code: "database",
  });
  assert.equal(route.publicMessage.includes("ai_chat_sessions"), false);
  assert.equal(errorMessage(route).includes("ai_chat_sessions"), true);

  console.log("ai error handling tests passed");
}

main();
