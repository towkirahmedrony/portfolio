# Chat backend migration: Gemini API -> Dify

**Route changed:** `src/app/api/ai/chat/route.ts` (POST `/api/ai/chat`, and its GET history handler kept as-is)
**Frontend:** unchanged — no file under `src/components/` or `src/lib/ai/client.ts` was touched.
**Result:** `tsc --noEmit` exit 0, `next build` exit 0, no `NEXT_PUBLIC_` secret, `/api/ai/context` untouched, no migration, no schema change.

Architecture now in place:

```
Chat UI (unchanged)
   |
   v
POST /api/ai/chat        <- adapter + website history only
   |  Authorization: Bearer ${DIFY_API_KEY}
   v
Dify Chatflow
   |-- HTTP Request node -> POST /api/ai/context (+ X-Dify-Context-Secret) -> Supabase live data
   `-- LLM (Nora)
   |
   v
{ type:"meta" } -> { type:"done", sessionId, message, cta }   <- same shape as before
```

---

## 1. Files created / modified / deleted

| Action | File | What changed |
| --- | --- | --- |
| **Created** | `src/lib/ai/dify.ts` | Server-only Dify client (new, 437 lines) |
| **Modified** | `src/app/api/ai/chat/route.ts` | Gemini replaced by Dify; response shape preserved |
| **Modified** | `src/lib/ai/sessions.ts` | `insertChatMessage` accepts an optional `metadata` |
| **Modified** | `src/lib/ai/errors.ts` | `"dify"` timing stage; secret redaction extended |
| **Modified** | `.env.example` | `DIFY_API_URL` / `DIFY_API_KEY` documented |
| **Deleted** | — | nothing was deleted |

Not modified, as required: `globals.css`, `layout.tsx`, `next.config.ts`, theme/config, `src/app/api/ai/context/route.ts` (`git diff --exit-code` clean), `src/types/*`, `src/components/**`, public/admin pages, `supabase/migrations/**` (`git status --porcelain supabase/` empty).

`git status` for the change set:

```
 M .env.example
 M src/app/api/ai/chat/route.ts
 M src/lib/ai/errors.ts
 M src/lib/ai/sessions.ts
?? src/lib/ai/dify.ts
```

## 2. What the new route does (and no longer does)

Order of work in `POST`:

1. Parse/validate JSON, reject a client-supplied `visitorId`, require a non-empty message (<= 4000 chars) and a valid UUID `sessionId`.
2. Gate on Supabase config, then on `isDifyConfigured()` (`DIFY_API_URL` + `DIFY_API_KEY`) -> 503 with a safe message.
3. Resolve the `ai_visitor_id` httpOnly cookie, `auth.getUser()`, then load the owned session plus a short lookback of messages in parallel (`Promise.all`).
4. Reuse the session (claiming it when a logged-in user takes over a visitor session) or create one with `titleFromMessage`.
5. Start the user-message insert so it overlaps the upstream call.
6. `sendDifyChatMessage({ user: sessionId, query: message, conversationId })`.
7. Persist the assistant message with the CTA and the Dify conversation id, then emit the same `meta` -> `done` NDJSON events as before.

Removed from this route (it is now Dify's job, per the spec):

- `getAiAssistantContext()` and `buildSystemPrompt()` — the route no longer reads `ai_knowledge`, `ai_rules`, `ai_faqs`, `ai_settings`, `services`, or `portfolio_projects`.
- `streamAssistantReply()` and every other Gemini import.
- No embeddings, no RAG, no retry loop, no external API besides Dify.

Dify request actually sent (asserted in the integration test below):

```
POST {DIFY_API_URL}/chat-messages
Authorization: Bearer {DIFY_API_KEY}
Content-Type: application/json
{ "inputs": {}, "query": "<user message>", "response_mode": "blocking",
  "user": "<website chat session uuid>", "conversation_id": "<only when known>" }
```

`user` is the website chat session id — stable per conversation, and no customer data, credentials, tokens or secrets are ever sent to Dify.

## 3. Response contract (unchanged, so the UI needs no edit)

The route still answers with `Content-Type: application/x-ndjson`:

```
{"type":"meta","sessionId":"..."}
{"type":"done","sessionId":"...","message":{...AiChatMessage...},"cta":{...}|null}
```

On failure it emits `{"type":"error","error":"<safe message>","code":"..."}`, which is exactly what `src/lib/ai/client.ts` already turns into the existing inline error row with the **Retry** button. Dify runs in `blocking` mode and the answer arrives whole, so no `delta` events are emitted; `client.ts` builds the final message from the `done` event either way (`src/lib/ai/client.ts:242-250`).

Because the contract is byte-compatible, `src/components/ai/project-assistant.tsx` is untouched.

## 4. Conversation continuity without a schema change

`ai_chat_sessions` has no Dify column and no migration was allowed, so the Dify `conversation_id` is stored in the **existing** `ai_chat_messages.metadata` jsonb column under the key `dify_conversation_id`, on the assistant row. The next request reads the newest value back from the rows it already loads (`readStoredConversationId`) and passes it to Dify. `ai_chat_sessions` and `ai_chat_messages` keep being written exactly as before; no table, column, or migration was added.

`insertChatMessage` now merges `metadata` as `{ ...metadata, ...(cta ? {cta} : {}) }`, so an existing `cta` still wins and `toPublicMessage` output is unaffected.

## 5. Error handling, timeout and logging

- Dify failures never reach the visitor raw. `DifyRequestError` carries a non-technical `publicMessageForDify`: `"Sorry, I'm having trouble responding right now. Please try again in a moment."` (plus the existing "took too long" / "busy right now" / "not available right now" variants for 504/429/503).
- Server-side timeout `AbortSignal.timeout(25_000)` (inside the route's `maxDuration = 30`); on abort it logs and returns the timeout error. No retry loop.
- Logs use the existing `[ai-chat]` channel: `dify.request`, `dify.response`, `dify.error` with `durationMs`, `httpStatus`, `success`, `userIdentifierType: "chat-session"`, `hasConversationId`, `queryChars`, and a 200-char capped upstream hint. The key, tokens, secrets, service-role key, and message text are never logged. `SECRET_PATTERN` in `src/lib/ai/errors.ts` was extended to also redact Dify app keys (`app-…`) and the two secret names.

## 6. Gemini code: still present, and why

Per instruction 14, nothing was deleted. `src/lib/ai/gemini.ts`, `src/lib/ai/env.ts` and `src/lib/ai/context.ts` are still on disk and still typecheck, but **nothing imports them any more**:

```
$ rg -n 'lib/ai/gemini|lib/ai/context|lib/ai/env' src
src/lib/ai/gemini.ts:8:} from "@/lib/ai/env";      <- only self-reference
```

Remaining `gemini` mentions and why each is still required:

| Location | Still required? |
| --- | --- |
| `src/lib/ai/gemini.ts` (515 lines) | Kept intentionally, now unused — remove only after live verification |
| `src/lib/ai/env.ts` | Only read by `gemini.ts` |
| `src/lib/ai/context.ts` | No importers after this change — kept as instructed |
| `src/lib/ai/errors.ts` | `GeminiRequestError` + `publicMessageForGemini` are used by `gemini.ts`; the pattern/redaction is live |
| `src/lib/ai/client.ts:252,289` | String literal fallback code, not a Gemini call |
| `src/app/api/ai/context/route.ts` | Only a comment and a "sensitive setting key" regex |

`generateContent` does not appear anywhere in the repo. `.env.example` keeps `GEMINI_*` but now labels them legacy; they were **not** removed because `env.ts`/`gemini.ts` still read them.

## 7. Environment variables

| Variable | Direction | Notes |
| --- | --- | --- |
| `DIFY_API_URL` | website -> Dify | Base URL only, no `/chat-messages`, e.g. `https://api.dify.ai/v1` |
| `DIFY_API_KEY` | website -> Dify | Server-only. Sent as `Authorization: Bearer`. Never `NEXT_PUBLIC_` |
| `DIFY_CONTEXT_SECRET` | Dify -> website | Different secret, unchanged, still used by `/api/ai/context` |

No value is hardcoded, and `rg 'NEXT_PUBLIC_DIFY|NEXT_PUBLIC_GEMINI' src` returns nothing.

## 8. Verification results

**TypeScript**

```
$ node node_modules/typescript/bin/tsc --noEmit
TSC_EXIT=0
```

> `npx tsc` could not be used: it tries to download a package named `tsc`. `npm run build` likewise fails with `sh: 1: next: not found` because this checkout has no `node_modules/.bin` directory. The project's own build command was therefore run through the CLI entry point it resolves to: `next build --webpack`.

**Build**

```
$ node node_modules/next/dist/bin/next build --webpack
BUILD_EXIT=0
...
├ ƒ /api/ai/chat
├ ƒ /api/ai/context
```

**Secret searches**

```
$ rg -n 'NEXT_PUBLIC_DIFY|NEXT_PUBLIC_GEMINI|generateContent' src
(no matches)
```

**Dify client integration test** — the real `src/lib/ai/dify.ts` compiled with `tsc` and run against a local mock Dify server: **17/17 checks passed**

```
PASS  parseDifyAnswer strips action tags
PASS  parseDifyAnswer unwraps a JSON envelope
PASS  parseDifyAnswer keeps plain prose untouched
PASS  readStoredConversationId reads the newest metadata value
PASS  readStoredConversationId returns null when absent
PASS  success returns the normalized reply and conversation id
PASS  request uses POST <base>/chat-messages with Bearer auth
PASS  request body matches the Dify chatflow contract
PASS  stored conversation id is passed back to Dify
PASS  action tags never reach the UI
PASS  HTTP 401 maps to auth/503 (code=auth, status=503, http=401)
PASS  HTTP 429 maps to rate_limit/429 (code=rate_limit, status=429, http=429)
PASS  HTTP 500 maps to upstream/502 (code=upstream, status=502, http=500)
PASS  a non-JSON 200 body is rejected (code=upstream, status=502, http=200)
PASS  an empty answer is rejected (code=empty, status=502, http=200)
PASS  a hung Dify request aborts on the server-side timeout (code=timeout, status=504)
PASS  timeout aborted at ~25s (took 25002ms)
```

**Route smoke tests** — production build served locally with `next start`, exercised over HTTP:

| Case | Response |
| --- | --- |
| Empty / whitespace message | `400 {"ok":false,"error":"Please enter a message.","code":"invalid"}` |
| Client-supplied `visitorId` | `400 {"ok":false,"error":"Anonymous identity is managed by the server.","code":"invalid"}` |
| Invalid `sessionId` | `400 {"ok":false,"error":"A valid sessionId is required.","code":"invalid"}` |
| Malformed JSON body | `400 {"ok":false,"error":"Request body must be JSON.","code":"invalid"}` |
| Array body | `400 {"ok":false,"error":"Request body must be a JSON object.","code":"invalid"}` |
| Oversized message (4 100 chars) | `400 {"ok":false,"error":"Message must be 4000 characters or fewer.","code":"invalid"}` |
| Valid message, nothing configured | `503 {"ok":false,"error":"The assistant is not configured yet.","code":"config"}` |
| Valid message, Supabase set, **Dify env missing** | `503 {"ok":false,"error":"The assistant is not available right now.","code":"config"}` + `[ai-chat] request.missing-dify-config { difyApiUrlPresent: false, difyKeyPresent: false }` |
| Valid message, Dify configured, DB unreachable | `500 {"ok":false,"error":"Could not start that conversation. Please try again.","code":"database"}` |
| `GET` without / with `sessionId` | `400` / `503` config, unchanged |

**Chat test cases requested in the spec**

| # | Case | Status |
| --- | --- | --- |
| 1 | "What services do you offer?" | Request path verified up to the upstream call; **content not verified live — needs real Dify + Supabase credentials** |
| 2 | "How much does a website cost?" | same |
| 3 | "I want to start a project." | same; CTA wiring verified separately (`[[action:start-project]]` is stripped and turned into the existing CTA button, action tags never reach the UI) |
| 4 | "Show me your projects." | same |
| 5 | Unrelated question | same |
| 6 | Empty message | **Verified** — `400` with the existing safe message |
| 7 | Dify/API failure | **Verified** — 401/429/500/timeout/non-JSON/empty answer all map to safe messages; config-missing path returns the existing 503 |

**Context flow** — unchanged by this work: Dify's HTTP Request node calls `POST /api/ai/context` with `X-Dify-Context-Secret`, that endpoint reads the six Supabase tables read-only and returns `{ success: true, context: {...} }`, Dify feeds it to the LLM, and Nora answers. The chat route no longer participates in that flow at all, so there is no duplicated filtering logic.

## 9. Remaining issues / things to know

1. **Live end-to-end tests were not run.** This environment has no Supabase URL, service-role key, `DIFY_API_URL` or `DIFY_API_KEY`, so the four content questions, the Dify/Host round trip and the `/api/ai/context` callback were not executed against real services. Run them once on a configured environment before deleting the Gemini code.
2. **The `ai_settings.enabled` kill switch is no longer enforced in the chat route**, because reading it would mean querying an AI table, which the spec forbids. If you want a website-side off switch, either keep it as a Dify concern or ask me to add a single-row check.
3. **Replies are no longer token-streamed.** With `response_mode: "blocking"` the UI shows its existing "Thinking…" placeholder until the whole answer arrives. No UI change was needed, but perceived latency differs from the old Gemini SSE stream.
4. **Orphaned modules kept on disk** — `src/lib/ai/gemini.ts` and `src/lib/ai/context.ts` now have no importers (both still compile). Removing them, and the `GEMINI_*` entries in `.env.example`, is the follow-up cleanup once step 1 passes.
5. `AI_CHAT_FIX_REPORT.md` in the repo root describes the previous Gemini-based behavior and is now historical.
6. The GitHub token shared in an earlier turn is still worth rotating at github.com/settings/tokens.
