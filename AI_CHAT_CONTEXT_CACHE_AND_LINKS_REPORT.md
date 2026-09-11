# /api/ai/context 5-minute cache + clickable links in Nora's replies

Two targeted changes. No schema change, no migration, no new dependency, no change to `/api/ai/context` security/relevance logic, no change to the NDJSON chat contract, and nothing touched outside the four files listed below.

## Files changed and why

| Action | File | Why |
| --- | --- | --- |
| Modified | `src/app/api/ai/context/route.ts` | The six dataset reads moved behind a 5-minute server-side cache; everything query-specific stays per request |
| Modified | `src/components/ai/project-assistant.tsx` | 2 hunks only: import `MessageText`, and render the message through it instead of a plain `<p>{message.content}</p>` |
| Created | `src/lib/ai/links.ts` | Safe link parsing: markdown links, a bounded set of page mentions, bare http(s) URLs, and a resolver that refuses unsafe schemes |
| Created | `src/components/ai/message-text.tsx` | Renders message text/link nodes with the existing styling; `next/link` internal, `target="_blank" rel="noopener noreferrer"` external |

`git status` for the change set:

```
 M src/app/api/ai/context/route.ts
 M src/components/ai/project-assistant.tsx
?? src/components/ai/message-text.tsx
?? src/lib/ai/links.ts
```

Nothing else moved: `supabase/` is clean (no migration), and `globals.css`, `layout.tsx`, `next.config.ts`, `src/types/**`, the chat client, the session/message architecture and every unrelated page are untouched.

## 1. The 5-minute cache

### Diagnosis

The six reads are **query-independent**: they filter on `published` / `is_active`, use fixed ordering and fixed limits, and take no query argument. The visitor query only drives the in-memory relevance ranking afterwards. So the datasets can be cached without touching relevance at all.

### Implementation

In `src/app/api/ai/context/route.ts`:

- The original `Promise.all` of the six queries was extracted verbatim into `fetchAssistantDatasets()` — same columns, same `published`/`is_active` filters, same `order`, same `LIMITS`. A whitespace-ignoring diff confirms only indentation changed for those query chains.
- That loader is wrapped with Next's Data Cache:

```ts
const getAssistantDatasets: () => Promise<DatasetsSnapshot> = unstable_cache(
  fetchAssistantDatasets,
  ["ai-context", "datasets", "v1"],
  { revalidate: DATASETS_CACHE_SECONDS, tags: [DATASETS_CACHE_TAG] },   // 300s
);
```

- `buildDifyContext(query)` now awaits that cached snapshot and then runs **all** of the existing query-dependent work unchanged: `normalizeText`/`tokensOf`, `rankServices`/`rankProjects`/`rankKnowledge`/`rankFaqs`, `isFocused` limits, `takeScored`, `selectRules`, `toSettingsMap` (including the sensitive-setting filter and de-duplication), and field clipping.

Why this satisfies the constraints:

- **No query-independent response was cached.** The call takes no arguments, so the cache entry is just the six raw datasets; the per-query relevance result is computed per request.
- **Server-side, Vercel-friendly.** Next's Data Cache is a durable cross-request cache (documented as shared across serverless invocations on Vercel) — no module state, no in-memory map.
- **Not publicly exposed.** The response still sets `Cache-Control: no-store`; the cache lives server-side only and holds only already-public rows.
- **No secret cached.** `DIFY_CONTEXT_SECRET` is read and compared per request in `isAuthorized`, exactly as before, and is never part of the cached value.
- **Logs kept and extended.** `unauthorized`, `config`, `failure`, `query.failed` and the timing log are all still there. The timing log now also reports `datasetsMs` and `datasetsLoadedAgoMs` so a cache hit is visible in Vercel logs.
- **No config change.** The stable Next 16 wording (`"use cache"` + `cacheLife`) needs `experimental.cacheComponents` in `next.config.ts`, which was off-limits, so `unstable_cache` was used deliberately.

### Evidence

Verified against a mock PostgREST server with a deliberate **700 ms** delay per query, driving the production build over HTTP:

| Call | Latency | Supabase queries |
| --- | --- | --- |
| 1 (cold) | **771 ms** | 6 |
| 2 (same query) | **16 ms** | **0** |
| 3 (different query) | **45 ms** | **0** |

The app's own logs agree:

```
call 1: datasetsMs: 744, datasetsLoadedAgoMs: 1,   servicesMs: 729, ... settingsMs: 737   <- miss
call 2: datasetsMs: 0,   datasetsLoadedAgoMs: 27,  (per-query values = the last real load)
call 3: datasetsMs: 0,   datasetsLoadedAgoMs: 71
```

Relevance is provably still per request — same cached rows, different results:

```
call 1 ("ecommerce shop payment integration") services: E-commerce Store Build | Web App Dashboard | Portfolio Website   projects: 2
call 3 ("show me your previous client work")   services: Web App Dashboard | Portfolio Website | E-commerce Store Build   projects: 4
```

`19/19` checks passed, including: identical JSON on a hit, `Cache-Control: no-store`, only the six expected tables read, unauthorized requests doing zero database work, secret-looking settings still filtered (`gemini_api_key` absent), duplicate setting keys still de-duplicated, and the exact field projections for services/projects/rules/knowledge/faqs.

**Expectation for production:** warm requests perform **zero** Supabase round-trips, so the ~1.3–2.5 s you see in Vercel logs collapses to Node/serverless overhead (16–45 ms here). Only the first request in each 5-minute window pays the database cost.

## 2. Clickable links in Nora's replies

### Diagnosis (frontend, not Dify)

I inspected the UI before changing anything: [project-assistant.tsx:447](src/components/ai/project-assistant.tsx) rendered the assistant message as

```tsx
<p className="whitespace-pre-wrap break-words">{message.content}</p>
```

There is **no markdown renderer at all** — no `react-markdown`, `remark`, `rehype`, `marked` or `sanitize-html` in `package.json` or `node_modules`. So Dify was returning text such as `[Services](/services)` and the UI printed it literally. The UI did already support a single CTA **button** via `message.cta`, but that is produced server-side by `buildCta`/`detectActionKey` — inline links were never rendered. The fix therefore belongs in the frontend renderer, and Dify needs no change.

### Implementation

`src/lib/ai/links.ts` (pure, no React) tokenises a message into text/link nodes:

- Markdown links `[label](/href)`, including the `"title"` form.
- Inline code spans are matched first, so a URL inside `` `backticks` `` is never auto-linked.
- Bare `http(s)://` URLs, with trailing sentence punctuation kept as text.
- A deliberately narrow phrase table for prose mentions, so Nora's examples work without false positives: `start a project` / `start your project` / `get started` → `/start-project`, `project assistant` → `/ai-assistant`, and `<services|projects|about|contact|home> page` → that route. Route hrefs come from the existing `AI_ROUTE_CATALOG`, so nothing is duplicated. Bare words like "about" or "services" are **not** linked.

`resolveMessageHref` is the security gate — it allows **only**:

1. same-origin relative paths (`/services`, `/projects/my-slug`); `//host` is rejected as protocol-relative,
2. explicit `http:`/`https:` URLs (parsed with `URL` and re-checked by protocol).

`javascript:`, `data:`, `vbscript:`, `mailto:`, `tel:`, `file:`, unknown schemes, whitespace, control characters and backslashes all return `null`, and the caller then renders the original text — so an unsafe link degrades to plain text instead of disappearing.

`src/components/ai/message-text.tsx` renders the nodes inside the **same** `<p className="whitespace-pre-wrap break-words">`, so layout and the streaming "cursor" span are unchanged. Internal links use `next/link`; external ones use `<a target="_blank" rel="noopener noreferrer">`. Styling uses only existing theme tokens (`text-accent`, `underline`, `decoration-accent/40`, `outline-ring`) — no `globals.css` or layout changes.

### Evidence

Rendering the **real component** to HTML (`react-dom/server`) produced genuine anchors:

```html
"Explore my [Services](/services) page."
  <p class="whitespace-pre-wrap break-words"><span>Explore my </span>
     <a href="/services" ...>Services</a><span> page.</span></p>

"Ready? [Start a Project](/start-project)"
  <a href="/start-project" ...>Start a Project</a>

"Explore my services on the Services page."
  <a href="/services" ...>Services page</a>

"Start your project here."
  <a href="/start-project" ...>Start your project</a>

"See [the live site](https://example.com/work) for details."
  <a href="https://example.com/work" target="_blank" rel="noopener noreferrer" ...>the live site</a>

"Bad [x](javascript:evil) good [Services](/services)"
  <span>[x](javascript:evil)</span> <a href="/services" ...>Services</a>   <- no unsafe anchor
```

`32/32` parser checks passed, covering all nine public routes (`/`, `/services`, `/projects`, `/about`, `/contact`, `/start-project`, `/ai-assistant`, `/login`, `/signup`), a project detail path, every rejected scheme listed above, protocol-relative URLs, code spans, multiple links per message, and the no-false-positive cases. The built client bundle for `/ai-assistant` contains the new classes and `rel="noopener noreferrer"`, confirming the component is really wired in.

## 3. Verification runs

```
node node_modules/typescript/bin/tsc --noEmit      -> exit 0
node node_modules/next/dist/bin/next build --webpack -> exit 0
19/19 context endpoint checks   (mock PostgREST, production build over HTTP)
32/32 link parsing checks
 6/6  component render checks
```

(`npx tsc` / `npm run build` cannot run in this checkout — there is no `node_modules/.bin` — so the same CLIs were invoked directly.)

Confirmed unchanged: `/api/ai/context` secret validation (still `timingSafeEqual` over SHA-256 hashes, still fails closed when `DIFY_CONTEXT_SECRET` is unset), `runtime/dynamic/maxDuration` segment config, the `{ success: true, context: { rules, knowledge, faqs, settings, services, projects } }` contract Dify parses, the NDJSON chat contract, and the chat session/message architecture.

## 4. Caveats

1. **No live Dify or Supabase credentials exist in this environment**, so the endpoint was proven against a mock PostgREST and Dify itself was not called. The JSON contract is shape-identical, so Dify's HTTP Request node needs no change — worth one real end-to-end run before shipping.
2. **Freshness window.** Edits to the six tables appear within 5 minutes. To publish immediately, call `revalidateTag("ai-context-datasets")` after an admin save (a one-line addition if you want it).
3. **Stampede.** If several requests arrive at the first moment after expiry, more than one may load the datasets. Harmless at this traffic level.
4. **Cache key versioning.** The key includes `v1`; bump it if the cached row shape ever changes.
5. **Mentions must be unambiguous.** `[Services](/services)` and page-qualified prose are clickable, and the existing CTA button is unchanged. A bare mention with no markdown and no page qualifier (e.g. "check /services") stays plain text on purpose, to avoid linking ordinary English words.
6. Bold/italic markdown (`**x**`) still renders literally, exactly as before — only links were in scope.
