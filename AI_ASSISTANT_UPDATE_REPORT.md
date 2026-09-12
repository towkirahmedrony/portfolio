# Nora assistant update: reasoning never shown, minimal header, Dify-owned config, client-side caching

Architecture unchanged: **custom chat UI → `/api/ai/chat` → Dify → Chatflow → `/api/ai/context` →
Supabase → Groq → Dify → UI**. No Dify Chatflow, Groq, Supabase schema, `/api/ai/context`, `globals.css`
or `layout.tsx` change (verified with `git diff --exit-code`).

---

## 1. Files changed

| File | Change |
| --- | --- |
| `src/lib/ai/response-text.ts` | **new** — pure `stripInternalReasoning()` normaliser shared by server and client |
| `src/lib/ai/dify.ts` | server-side normalisation: `parseDifyAnswer()` strips reasoning/envelopes before anything is stored or returned |
| `src/components/ai/message-text.tsx` | renders through the same normaliser (defensive second half); lists/paragraphs/links unchanged |
| `src/components/ai/project-assistant.tsx` | header reduced to `← avatar name`; history cache wiring; silent restore; desktop-centred composer untouched |
| `src/lib/ai/client.ts` | two separate sessionStorage caches (history + config) with TTLs and guards |
| `src/lib/ai/ui-config.ts` | `configSource`; suggested questions are no longer substituted from the fallback |
| `src/lib/ai/ui-defaults.ts` | fallback `suggestedQuestions: []` (questions are never invented) |
| `src/types/ai.ts` | `AiUiConfigSource` + `configSource` on `AiUiConfig` |
| `src/app/ai-assistant/page.tsx` | stops passing a header title (header shows only the back icon, avatar and name) |

Not touched: `globals.css`, `layout.tsx`, `src/app/api/ai/context/route.ts`, Supabase schema/migrations,
`next.config.ts`, `package.json` (no new dependency), auth, project-request, contact, portfolio/services.

## 2. `<think>` filtering

`stripInternalReasoning(input)` in `src/lib/ai/response-text.ts`, applied in **two layers**:

1. **Server** — `parseDifyAnswer()` normalises Dify's `answer` before it is parsed for tags, stored in
   Supabase, or returned to the browser. Internal reasoning therefore never even reaches the database.
2. **Client** — `MessageText` runs the same function at render time, so legacy rows, cached payloads, or
   anything else that predates this change can never be displayed either.

What it removes, defensively:

- complete `<think>…</think>` blocks: **multiline**, **any case** (`<THINK>`, `<Think>`), **repeated**
  (all of them, in a bounded loop), plus `thinking`, `reasoning`, `analysis`, `scratchpad` variants;
- the tag name is captured, so `<think>…</thinking>` does not pair up by accident;
- stray closing tags whose opening tag was already gone;
- an **unclosed** opening tag (reasoning truncated mid-stream) — everything from that tag onwards is
  dropped, which is the safe direction for internal content;
- whitespace/newlines left around a removed block (edges tidied, internal indentation preserved);
- **JSON transports** around the answer: `{"answer": "…"}`, `{"text"|"output"|"response"|"result"|
  "content": "…"}`, optionally inside a ```json fence, and nested up to 3 levels, with the reasoning pass
  re-run on the unwrapped value;
- `{"message": …}` / `{"action": …}` envelopes are deliberately **left alone** — that is Dify's structured
  reply and carries the CTA, which `parseDifyAnswer()` handles itself.

It never touches ordinary prose: braces only disappear when the *entire* message parses as one of the
known transports. `Use {curly braces} and JSON like {a: 1} in prose.` is returned verbatim (unit-tested).

A reply that is *only* reasoning becomes an empty string, which the existing adapter maps to a 502
"empty reply" → the friendly UI error, never a blank bubble.

## 3. Dify configuration fields loaded

`GET /api/ai/config` (server-side, `DIFY_API_URL` + `DIFY_API_KEY`, never exposed to the browser) reads
Dify's **`GET /site`** and **`GET /parameters`** and returns:

| Frontend field | Dify source |
| --- | --- |
| `name` | `/site` → `title` |
| `avatar`, `avatarType` | `/site` → `icon_url` / `icon`, `icon_type` |
| `inputPlaceholder` | `/site` → `input_placeholder` |
| `welcomeMessage` | `/parameters` → `opening_statement` |
| `suggestedQuestions` | `/parameters` → `suggested_questions` |
| `themeColor` | `/site` → `chat_color_theme` |
| `configSource` | `dify` when Dify answered, `fallback` when it did not |

Nothing about Nora is hardcoded as the primary source. If Dify is unreachable the neutral fallback keeps
the page usable (`configSource: "fallback"`), which is now visible in the response so a missing
`DIFY_API_URL`/`DIFY_API_KEY` in the deployment is immediately obvious.

## 4. Suggested questions

Dify's `suggested_questions` is the **only** source. The previous fallback substitution is gone
(`DEFAULT_AI_UI_CONFIG.suggestedQuestions = []`), so questions are never invented: Dify returning none —
or the config failing — hides the whole section (chips **and** the "Try asking" label) gracefully.

## 5. Chat history cache

`sessionStorage`, key `ai-project-assistant-history`, **TTL 5 minutes**, separate from the config cache.
Contents: `{ version, sessionId, messages, cachedAt }`; entries are validated (version, uuid, message
shape, finite timestamp) and deleted when stale, corrupt or future-dated.

- **First open** — no cache → history is fetched, then written to the cache.
- **Returning (within TTL)** — the cached conversation is the initial state, so it renders immediately and
  **no history request is made**. Verified: 0 requests on both client-side navigation and full reload.
- **After the TTL** — the entry is treated as absent, history is refetched silently and the cache replaced.
  Verified (age forced to 6 minutes): exactly 1 request, no duplicate messages.
- **After sending** — a single effect keeps the cache in step with the rendered conversation; it is skipped
  while sending so an in-flight reply is never cached.
- **Optimistic messages are never cached** (`local-` ids are filtered out), so a failed or pending message
  cannot reappear as a duplicate after a later fetch merges.
- **New chat** — cache + session id cleared, `generationRef` drops any in-flight reply from the previous
  thread, so nothing can mix.
- **Delete** — the cache is cleared with the server-side deletion, so navigating away and back cannot bring
  the deleted messages back.
- Merging uses stable ids: server messages win, and only local extras that are genuinely new are kept.

## 6. Configuration cache

Two layers, both independent of the history cache:

- **Server**: `unstable_cache(["ai-assistant-ui-config"], { revalidate: 300 })` + `s-maxage=300,
  stale-while-revalidate=60` → Dify's `/site` and `/parameters` are read at most once per ~5 minutes.
- **Client**: `sessionStorage`, key `ai-project-assistant-config`, **TTL 5 minutes**. Only real Dify
  configuration is cached — never the fallback — so a transient failure cannot be pinned for 5 minutes.
  Verified: navigating away and back issues **0** additional `/api/ai/config` requests.

## 7. Header

`← Back | Nora | AI Project Assistant …` → **`← 🤖 Nora`**.

- the "Back" **text** is gone; the icon-only link keeps its `aria-label`/`title` for accessibility and still
  navigates to `/`;
- the "AI Project Assistant" subtitle is gone;
- Nora's name (h1, from Dify) and Dify's avatar (emoji or image, with the local icon as fallback) remain;
- the ⋮ menu (New chat / Delete chat) is unchanged.

## 8. Test results

Production build served by `next start`, with faithful local stand-ins for the two external services
(mock Dify service API + mock PostgREST) because this environment has no Dify/Supabase credentials. All
website code under test is real; the mock Dify answered **every** message with a `<think>` block.

**Response / reasoning**

| Check | Result |
| --- | --- |
| Dify answer `<think>…</think> Ran through Dify…` rendered | only the final answer; `thinkLeak: false`, `thinkWordCount: 0` |
| Same reply stored in Supabase | assistant row contains **no** `think` — stripped before storage |
| Legacy stored row containing `<think>legacy internal reasoning…</think> Legacy visible answer.` | renders `Legacy visible answer.` only |
| Unit suite (22 leak checks + 7 exact assertions) | 22/22 and 7/7 pass: multiline, case variants, multiple blocks, whitespace, truncated, stray close tag, JSON/fenced/nested envelopes, bullets & indentation preserved, prose braces untouched, `{"message":…}` envelope preserved |

**Header** — `headerText: "← | 🤖 | Nora AI"`, `backWordInHeader: false`, `subtitlePresent: false`, one `h1`.

**Dify drives the UI** — with **no website source change**, changing Dify's `title`, `icon`,
`opening_statement` and `suggested_questions` changed the site to: header `← 🤖 Nora AI`, welcome
"Welcome from Dify! Ask me anything about your project.", chips "Do you build Shopify stores?" /
"What is your turnaround time?" (the previous four chips gone).

**History**

| Step | Result |
| --- | --- |
| Send a message | reply rendered; cache written (`messages: 2`); history requests 0 |
| Navigate to `/` and back | conversation present, **history fetches delta 0**, config requests still 1 |
| Full page reload (within TTL) | conversation present, **history fetches delta 0**, no "loading" text |
| TTL forced to 6 min, then navigate back | **delta 1** fetch, conversation intact, no duplicates |
| New chat | welcome + Dify chips back, previous reply gone, session & history cache cleared, no mixing |
| Delete chat | confirm dialog (title + Cancel/Delete), deleted conversation gone, cache cleared |
| Delete then navigate away/back | deleted messages do **not** return |
| Thinking indicator | appears immediately after send (user bubble already shown), gone the moment the reply arrives, also gone on error; never shown while loading config/history |

**Error handling** — Dify unreachable: `/api/ai/config` → `configSource: "fallback"`, neutral name/welcome,
`suggestedQuestions: []` (no invented questions), page still usable; sending shows
"Sorry, I'm having trouble responding right now. Please try again in a moment." with a working **Retry**,
and no API key, Dify URL or stack trace in the page.

**Mobile** — 390×844: composer fully visible, no horizontal overflow, shell exactly viewport height.
Keyboard proxy (focused composer, viewport 844 → 420 → 844): shell tracks the visual viewport, composer
bottom 408 ≤ 420, focus retained. Desktop 1280×800: messages and composer both in the 768 px centred
column (256 px gutters), no overflow.

## 9. Build result

- `tsc --noEmit` → exit 0
- `eslint` (ai components, ai lib, ai routes, page, types) → exit 0
- `next build --webpack` → **Compiled successfully**, `/ai-assistant` = `ƒ` (dynamic), exit 0

## 10. Remaining issues

1. **Not verified against the live stack.** No Dify/Groq/Supabase credentials exist in this environment, so
   the two external services were simulated. The website side is fully exercised; one real message on the
   deployed site is still worth doing — and if the header shows "Project assistant" with no suggested
   questions, `DIFY_API_URL`/`DIFY_API_KEY` are missing in the Vercel environment (`configSource` will say
   `fallback`).
2. **Real Android device not available.** Keyboard behaviour was verified through the visual-viewport
   resize path plus mobile emulation (touch enabled), not on physical hardware.
3. **Aggressive truncation trade-off.** An unclosed reasoning tag drops everything after it. That is
   deliberate (internal reasoning must never be shown), but it means a reply that literally *quotes* an
   unclosed `<think>` would lose its tail. Paired blocks are removed precisely, so only malformed or
   truncated output is affected.
4. Unused leftovers still on disk, untouched: `src/lib/ai/gemini.ts`, `env.ts`, `context.ts`,
   `GeminiRequestError` in `errors.ts`.
