# AI Chat Fix — Report

Repo: `towkirahmedrony/portfolio` @ `9a597c6` (Next.js 16.3.4, React 19, Supabase, Gemini REST `streamGenerateContent`)

Two separate defects were found and fixed:

1. **A schema bug introduced by the previous commit** (`9a597c6`): the AI context queries were changed from `.select("*")` to explicit column lists that do not exist in the live database, which silently emptied the assistant's entire knowledge base.
2. **A latency bug**: the request is dominated by Gemini's time-to-first-token under the model's *default* thinking budget, not by Supabase, not by caching, and not by sequential awaits (those were already parallelised by the previous commit).

---

## 1. Required before/after statement

| | Before (production, as reported) | After (measured) |
|---|---|---|
| Function execution | ~24.23 s | **not measurable from this environment** |
| First streamed token | ~24 s (the client waited for the full answer) | **not measurable from this environment** |
| Total response | ~24.6 s | **not measurable from this environment** |

I could not run your production build: this environment has no Supabase URL/keys, no `GEMINI_API_KEY`, and no access to your Vercel deployment. **I will not invent those three numbers.** What I did instead:

* reproduced the whole request path locally against a harness that implements the **verified live schema** and a mock Gemini endpoint, and
* measured the same stages on the pre-fix code and the post-fix code.

### What the local harness measured (mock backends, clearly not your production)

Harness: mock PostgREST (120 ms per DB round trip, 6 AI/public tables) + mock Gemini SSE with a scripted first-token delay. Same machine, production build (`next start`), one `POST /api/ai/chat`.

| Stage | Before (pre-fix code) | After (fixed code, cold context) | After (fixed code, warm context) |
|---|---|---|---|
| First byte | 484 ms | 488 ms | 198 ms |
| **First streamed token** | 16 494 ms | **1 390 ms** | **1 097 ms** |
| Function / total | 16 945 ms | 1 838 ms | 1 545 ms |
| Context queries (`select`/`order` on the 6 tables) | 6 attempted → **4 rejected** | 6, all succeed | **0** (cache hit) |
| Message/session writes | 3 | 3 | 2 |
| Streaming deltas | 8 incremental | 8 incremental | 8 incremental |

The 16 945 ms "before" figure is the mock's scripted *model-default* first-token delay (16 000 ms) plus ~900 ms of real app work — it is the shape of your production problem, not a measurement of Google's API. The same mock configured to accept `thinkingConfig` returns the first token in ~900 ms, which is what produced the ~1.1 s first-token rows above.

### The one number that matters most

Same code, same harness, same request — only the Gemini thinking setting differs:

| Gemini thinking setting | First streamed token | Total |
|---|---|---|
| `thinkingLevel: "low"` (new default) | **1 390 ms** | 1 838 ms |
| not sent → model default = **"medium"** for `gemini-3.6-flash` | **16 354 ms** | 16 802 ms |

**≈ 15 s of the request is thinking time before the first visible token.** Google's own documentation states that `gemini-3.6-flash` thinks by default at level *medium*, that the accepted levels are `minimal|low|medium|high`, and that lowering `thinking_level` is the correct way to reduce latency. A third-party benchmark (artificialanalysis.ai) lists Gemini 3.6 Flash (high) with a best-provider time-to-first-answer-token of 16.76 s — consistent with the reported ~24 s end-to-end once generation is added.

---

## 2. Exact bottleneck (STEP 1 → STEP 7 findings)

Measured with the new instrumentation on one message (after fix, warm cache):

| Stage | Measured | Verdict |
|---|---|---|
| `auth` (`supabase.auth.getUser()`, anonymous) | 1–4 ms | not the bottleneck (no session → no network call) |
| `context` (6 AI/CMS tables, cached) | 185 ms wall on a cold build, **1 ms warm** | not the bottleneck; parallel, cached |
| `session-load` + `history-load` | 126 ms + 127 ms (parallel) | one round trip, not the bottleneck |
| `session-create` (new conversation only) | 130 ms | once per conversation |
| `user-message-save` | 126 ms | overlaps Gemini |
| `assistant-message-save` | 124 ms | after generation |
| **`gemini`** | **1 231–1 264 ms** (mock) | **dominant term** |
| **`gemini-first-token`** | **910 ms with `low`; 16 027 ms with the model default** | **the 24 s** |
| `total` | 1 487–1 838 ms | |

Answering the four candidate causes in STEP 3 directly:

* **Supabase?** No. All 6 context queries run in parallel; wall time 165–185 ms for six 120 ms queries proves parallelism (sequential would be ~900 ms). Per message with a warm cache the cost is 2 reads + 2 writes.
* **Gemini?** Yes — specifically *time-to-first-token*, which is thinking time, not network.
* **Application logic?** No. Every independent operation is already parallel (`Promise.all` for auth+context, for session+history, and for the 6 context queries). The only remaining sequential dependency is `session/history → writes`, which is inherent.
* **Repeated requests?** No. One submission produces exactly one `POST /api/ai/chat`.

The pre-fix code was also **not** waiting for the complete response before returning: `streamGenerateContent` with `alt=sse` and an NDJSON `ReadableStream` were already in place. Streaming was working; it just had nothing to say for 16–24 s because the model was thinking, and the deltas that followed were only ~88 characters.

---

## 3. The schema bug (STEP 2) — and why it was worse than a log line

Commit `9a597c6` replaced `.select("*")` with explicit column lists that do not exist in the live database:

| Table | Code was selecting / ordering | Live schema (source of truth) |
|---|---|---|
| `ai_settings` | `key,value,is_active` | `setting_key,setting_value,description,is_active` |
| `ai_rules` | `title,content,category,priority,is_active` | `rule_type,name,instruction,priority,is_active` |
| `ai_knowledge` | `… .order("sort_order")` | `category,title,content,priority,is_active`, order by `priority` |
| `ai_faqs` | `question,answer,is_active … .order("sort_order")` | `category,question,answer,keywords,priority,is_active`, order by `priority` |

The reproduction against a schema-validating mock produced **exactly the four production errors**:

```
column ai_settings.key does not exist
column ai_rules.title does not exist
column ai_knowledge.sort_order does not exist
column ai_faqs.sort_order does not exist
```

Two consequences that the log lines hid:

* `loadActiveRows()` caught the error and returned `[]`, so `ai_rules`, `ai_knowledge`, `ai_faqs` and `ai_settings` were all empty. The assistant was answering with **no rules, no knowledge, no FAQs and default settings** — while the `services` and `portfolio_projects` queries (which do have `sort_order`) kept working, so it looked alive.
* `unstable_cache` then cached that empty result, so the wrong behaviour persisted for the whole revalidate window.

`asSettingsMap()` was also reading `record.key` / `record.value`, which do not exist, so settings never applied even before the explicit-column change.

---

## 4. Changes made (STEP 2, 4, 5, 6, 8, 9, 10)

7 files, `844 insertions(+), 321 deletions(-)`. No database change, no migration, no DDL, no RLS change, no compatibility columns.

### `src/lib/ai/context.ts` (rewritten)
* Correct live columns and `priority` ordering for all four AI tables; `asSettingsMap` reads `setting_key`/`setting_value`; `formatRules`/`formatKnowledge`/`formatFaqs` read `rule_type`/`name`/`instruction`, `title`/`content`/`category`, `question`/`answer`/`keywords`.
* A failed query now throws `AiContextQueryError` instead of resolving to `[]`, so a broken query can never be cached as "no knowledge" again, and the failure names its table.
* **Removed the blanket 6 000-character `clipContext()`** that silently truncated the whole system prompt — which, once the knowledge base was populated, would have cut off the response-format instructions and the action catalog at the tail. The instruction block is now assembled complete (2 377 chars) and only the *data* block is budgeted: per-section limits, weighted shares of an 8 000-char budget so a pricing question can never lose the `services` section to a large knowledge base, plus a last-resort trim.
* **Intent-aware sections**: `rules` always; `services` (full detail) only for pricing/services/start-project questions, otherwise a one-line-per-service digest; `portfolio_projects` only for portfolio/work questions; `knowledge` + `faqs` always. The database fetch is unchanged and still cached — this only changes what goes into the prompt, keeping it compact.
* Removed the redundant second cache layer (module-level promise cache) — one cache (Next data cache, `revalidate` 120 s → 300 s).
* Exposes per-table build timings and whether the snapshot was a cache hit or a rebuild.

### `src/app/api/ai/chat/route.ts`
* Per-stage timing for **every** stage, separating auth from context (they were previously merged into one meaningless `auth-context` mark).
* `buildSystemPrompt(context, message)` replaces the single global prompt, so context is assembled per message from the cached snapshot with **zero extra database work**.
* The user-message insert is started before streaming so it overlaps Gemini, with a rejection guard so a fast failure cannot become an unhandled rejection; `meta` is still the first streamed event; the assistant message is still persisted *before* the `done` event so the saved row id is returned. No writes removed, no duplicate messages or sessions.
* Error/status semantics preserved (404 for a session that is not yours, 503 when the assistant is disabled, stream `error` event once streaming has begun).

### `src/lib/ai/gemini.ts`
* `thinkingConfig.thinkingLevel` is sent (default `low`) — **the actual latency fix**.
* If a model rejects it with a thinking-related HTTP 400, the request is retried **exactly once** without `thinkingConfig` (verified against the mock: one 400, then one 200, request succeeded). The tuning can never cause an outage.
* Mid-stream aborts (the 25 s request timeout) are now mapped to a `timeout` error instead of an unhandled exception; the `done` event reports the first-token latency.
* The Gemini origin is read from `GEMINI_API_ORIGIN` (default unchanged: the public API). This exists so the request path can be tested against a local mock; production behaviour is identical when the variable is unset.
* Upstream error text is capped at 200 characters so a Gemini error can never echo prompt content into logs.

### `src/lib/ai/env.ts`, `.env.example`
* `GEMINI_MODEL` remains the single source of the model; fallback `gemini-3.6-flash` (the model already chosen for this project). **No `gemini-2.0-flash` anywhere** (verified).
* Added documented `GEMINI_THINKING_LEVEL` (`minimal|low|medium|high`, `off`/`none`/`default` to defer to the model) and the optional `GEMINI_API_ORIGIN`.

### `src/lib/ai/errors.ts`
* `createAiTimer()` gained `set()`/`report()`; a single report emits one line per stage in exactly the requested format, once per request, on both the streaming and error paths.

### `src/types/database.ts`
* The four AI table types updated to the live columns (`rule_type`/`name`/`instruction`, `keywords`, `priority`, `setting_key`/`setting_value`/`description`). They were stale generated types describing the pre-live schema.

---

## 5. Query and write counts

Per user message:

| | Before | After |
|---|---|---|
| Context table queries | 0 per message while cached; 6 attempted (4 rejected) per revalidate window (120 s) | 0 per message while cached; 6 succeed per revalidate window (300 s) |
| Session + history reads | 2 (parallel) | 2 (parallel) |
| Writes | 2 (user + assistant), 3 with a new session | 2, 3 with a new session (unchanged) |
| Failed queries | 4 per revalidate window | 0 |
| Order-form tables (`order_form_steps/fields/options`) | not loaded | not loaded (logged as `form-data = 0ms (not loaded)`) |

I did **not** reduce the query count of a cold context build: it is still one query per table, which is already the minimum for those six sources, and they run in parallel. The real reductions are: 4 broken queries → 0, context rebuilds −60 % (120 s → 300 s window), and the removal of the redundant in-process cache layer.

---

## 6. Streaming

Verified end-to-end against the harness: `Content-Type: application/x-ndjson`, `meta` first, then 8 incremental `delta` events as the mock streams, then `done` with the persisted message id and CTA. First token arrived at ~1.1–1.4 s while the response completed at ~1.5–1.8 s, i.e. the browser renders progressively and the total is not the first-token wait. The client (`src/lib/ai/client.ts`) already had incremental NDJSON parsing and a single-flight guard.

---

## 7. Frontend: duplicate requests (STEP 10)

Checked and **no duplicate `POST`**:

* one `<form onSubmit>` and one `Enter` handler, both funnel into `sendMessage`;
* `event.preventDefault()` on the keydown stops the implicit submit, and `sendingRef.current` is set synchronously before any `await`, so a double click/Enter can only produce one request;
* the send button is disabled while sending; the retry button is disabled while sending;
* no retry logic in the client; no request recreation; `loadAiChatHistory` is a `GET`, not a `POST`;
* `useEffect` only loads history; under React StrictMode in **development** that effect can run twice and issue two history `GET`s, which is a dev-only, read-only cost.

Not changed: `project-assistant.tsx` contains two implementations of the same history load (the `loadHistory` callback and an inline copy inside the `useEffect`). That is duplication, not a bug, and changing it would add risk for no functional gain.

---

## 8. How to read the real numbers (do this in production)

Every request now logs, in this exact shape, once per request:

```
[ai-chat] timing.session-load = Xms
[ai-chat] timing.history-load = Xms
[ai-chat] timing.settings = Xms (cache hit, 0 queries | built now, cached 300s)
[ai-chat] timing.rules = Xms
[ai-chat] timing.knowledge = Xms
[ai-chat] timing.faqs = Xms
[ai-chat] timing.services = Xms
[ai-chat] timing.portfolio = Xms
[ai-chat] timing.form-data = 0ms (not loaded)
[ai-chat] timing.gemini = Xms
[ai-chat] timing.gemini-first-token = Xms
[ai-chat] timing.user-message-save = Xms
[ai-chat] timing.assistant-message-save = Xms
[ai-chat] timing.session-create = Xms
[ai-chat] timing.auth = Xms
[ai-chat] timing.context = Xms
[ai-chat] timing.total = Xms
```

No API key, service-role key, access token, customer data or conversation content is logged anywhere (only durations, sizes, counts, section names and ids). There is also a `context.prompt` line with `promptChars` / `instructionChars` / `dataChars` / `sections` / `droppedSections`, and `gemini.request` logs the model and the effective thinking level.

Then fill in the blanks:

* **If `timing.gemini-first-token` is large (seconds) and `timing.gemini` ≈ `timing.total`** → Gemini thinking dominates, as diagnosed. Set `GEMINI_THINKING_LEVEL` (`minimal` or `off` to compare) and re-measure.
* **If `timing.total − timing.gemini` is large** → the cost is Supabase; the per-table lines will name the table.
* **If a `context.query-failed` line appears** → a column/table mismatch; the line now names the source table instead of being swallowed.

These logs are temporary instrumentation. Remove `logAiTimingReport`/`report()` (and the `timer.*` calls) when you are done.

---

## 9. Remaining bottlenecks and honest caveats

1. **Gemini generation time still dominates the total.** If `thinkingLevel: "low"` is not enough, the remaining levers are a faster model, a shorter `maxOutputTokens` (currently 768), and shorter answers — in that order. `thinkingLevel` is configurable without a deploy change.
2. **`maxDuration = 30` with a 25 s Gemini timeout is a cliff.** A response that legitimately needs >25 s is aborted mid-stream. With thinking lowered this is unlikely, but the two numbers should be revisited together.
3. **The Next.js proxy/middleware runs on `/api/*`** and calls `supabase.auth.getUser()` (plus `sync_customer_session` for signed-in users) on every request — a fixed per-request cost that is outside the AI chat scope. Your own report shows ~234 ms there.
4. **The assistant-message insert sits between generation finishing and the `done` event** (~125 ms locally). It is required so `done` carries the persisted row id; removing it would break persistence.
5. **`portfolio_projects` is included for any message matching `projects?`,** e.g. "how do I start a project?", which adds ~2 KB that the question may not need. It is inside the 8 KB budget, so it is waste, not a bug.
6. **Admin edits to the `ai_*` tables can take up to 5 minutes to appear** (data cache `revalidate: 300`). If that is too slow, add `revalidateTag` to the AI admin actions — I deliberately did not wire a cache tag that nothing invalidates.
7. **`unstable_cache` is deprecated in Next.js 16** in favour of the `use cache` directive. It still works (verified — the warm-cache logs show 0 context queries), and migrating is a separate, larger change.
8. **The repo's migration for these tables is stale relative to the live database.** `supabase/migrations/20260910200000_ai_project_assistant.sql` still declares `ai_settings.key/value` and `ai_rules.title/content` / `sort_order` columns, and its seed block inserts with those old column names. Its `create table` statements are guarded by `if to_regclass(...) is null`, so replaying it will not recreate your tables — but the seeds would fail if those tables were ever empty. I did not touch it, per your instructions. It is worth a follow-up migration that documents the live shape.
9. **Not verified in production.** I could not measure your real function execution, first streamed token or total. Everything above is either a code fact, a local measurement against mock backends, or cited third-party data.

---

## 10. Verification performed

| Check | Result |
|---|---|
| `npx tsc --noEmit` | pass |
| `npm run lint` | 0 errors (3 pre-existing warnings in untouched files) |
| `next build --webpack` | pass |
| `node scripts/test-ai-errors.mjs` (repo's own AI test) | pass |
| `grep` for `ai_rules.title`, `ai_knowledge.sort_order`, `ai_faqs.sort_order`, `ai_settings.key`, `gemini-2.0`, `clipContext`, `context.systemPrompt` in `src/` and `.env.example` | none found |
| `git status` / `git diff --name-only` | exactly the 7 source files listed above; nothing else modified; `supabase/` untouched; this report is the only added file (delete it if you do not want it in the repo) |
| One AI message end-to-end | 200, 8 streamed deltas, assistant message persisted, CTA applied |
| Schema-accurate reproduction | pre-fix code reproduces all four production errors; post-fix code produces zero |
| Caching | cold build = 6 queries; warm request = 0 context queries |

An independent verification sub-agent could not be run: the runtime's verification-packet validator rejected both submission attempts (`verification_packet_validation_failed_twice`), so the checks above were performed directly. The reproduction harness lives outside the repo at `/tmp/ai-harness/` (`mock-server.mjs`, `measure.mjs`, and the raw logs `app-before.log`, `mock-before.log`, `app-final2.log`, `mock-final.log`, `app-bulk2.log`, `mock-bulk.log`).
