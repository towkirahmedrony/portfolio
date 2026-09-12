# Nora assistant: audit and fix (avatar, hero welcome, questions, caching)

Backend untouched: Dify + Groq, `/api/ai/chat`, `/api/ai/config`, `/api/ai/context`, existing sessions,
anonymous visitor behaviour and the database schema are unchanged. `git diff --exit-code` is clean for
`/api/ai/context`, `globals.css`, `layout.tsx`, `supabase/` and `package.json`.

## 1. Files changed

| File | Change |
| --- | --- |
| `src/lib/ai/ui-config.ts` | Dify asset URL resolution (absolute / protocol-relative / root-relative against the **Dify** origin), emoji vs image icons, icon file id, `avatarProxyUrl`, tolerant `suggested_questions` parsing (`{question}` objects too) |
| `src/app/api/ai/avatar/route.ts` | **new** — same-origin avatar passthrough (`GET {DIFY_API_URL}/files/{file_id}/preview` with `DIFY_API_KEY`, server-side only) |
| `src/lib/ai/dify.ts` | `getDifyAssetOrigin()`, `fetchDifyFilePreview()` |
| `src/lib/ai/client.ts` | history/config caches gain stale reads + a `useSyncExternalStore` config store; new config shape; `avatarUrl`/`avatarProxyUrl`/`avatarEmoji` validation |
| `src/types/ai.ts`, `src/lib/ai/ui-defaults.ts` | config contract: `avatarUrl`, `avatarProxyUrl`, `avatarEmoji`, `avatarType`, `avatarFileId`, `openingMessage`, `suggestedQuestions`, `inputPlaceholder`, `configSource` |
| `src/components/ai/project-assistant.tsx` | centred hero empty state, avatar fallback chain, stale-while-revalidate history, config from the store |

Not touched: `globals.css`, `layout.tsx`, `/api/ai/context`, the Dify chatflow, Supabase schema/migrations,
auth, project-request, contact, portfolio/services, `next.config.ts` (no new dependency).

## 2. Why the avatar was failing

**Dify signs its app-icon URL with an expiry, and every cache around it outlives that signature.**

Investigated the real deployment rather than guessing:

```
GET https://shakib-shahriar.vercel.app/api/ai/config
  avatar: "https://upload.dify.ai/files/82dcbef1-…/file-preview?timestamp=…&nonce=…&sign=…"
  avatarType: "image",  configSource: "dify"
```

Then the URL itself:

```
HTTP/2 404
{"code":"not_found","message":"File not found or signature is invalid","status":404}
```

and in the browser, on the live page: `<img>` present with `naturalWidth: 0` — the image never loads.
Meanwhile a **freshly issued** URL for the same icon does load (on the live deployment, right after a
revalidation, the identical `<img>` reported `loaded: true, naturalWidth: 1024`). The URL is not
permanently broken — it is *time-limited*: the icon URL inside a cached configuration has usually expired
by the time a browser uses it, because three caches sit between Dify and the image (server
`unstable_cache` 300 s, CDN `s-maxage` 300 s, client 300 s) while the signature lives for less.

What was fixed:

1. **URL handling.** Dify URLs are used exactly as returned when they work: absolute `http(s)` verbatim,
   protocol-relative `//host/…` upgraded to https, and a root-relative `/path` resolved against the
   **Dify origin** (verified: `/icon.png` → `http://<dify-host>/icon.png`, never the website origin).
   Emoji icons (`icon_type: emoji`) stay emoji instead of becoming an image.
2. **A passthrough that mints a fresh URL.** `/api/ai/avatar` reads `/site` **directly (cache bypassed)**
   to mint a currently-valid icon URL, streams its bytes, and only then falls back to the URL the cached
   configuration holds and finally to the authenticated file API
   (`GET {DIFY_API_URL}/files/{file_id}/preview`). It takes **no parameters** — it can only ever return
   the icon of the app this deployment is configured for — and `DIFY_API_KEY` never reaches the browser.
3. **A fallback chain in the UI:** Dify's exact URL → `/api/ai/avatar` → Dify's emoji → the local mark,
   all rendered as a plain `<img>` (no global Next.js image configuration needed) with the fallback layer
   *underneath* the image, so a failure can never produce a broken image or an empty circle.

Verified against the mock Dify in four modes: broken `icon_url` → loads through `/api/ai/avatar`; working
`icon_url` → used directly; root-relative `icon_url` → resolved to the Dify origin; emoji → emoji, no
`<img>`. Then the real failure mode: a mock whose signature expires after 8 s while the config cache stays
fresh — the primary URL is rejected (`icon.png rejected (signature expired), ageSeconds: 29…77`), the
passthrough mints a new one, and the avatar still renders (`loaded: true`).

**No action is needed on the Dify side** — the live passthrough already returns Nora's real icon
(`200`, `image/webp`, 25 052 bytes) and the live page renders it with zero broken images.

## 3. Why the suggested questions were not appearing

Because **Dify returns none**. Read straight from Dify's own public app API:

```
GET https://udify.app/api/parameters?appCode=JJJAG3buEHt2zB4O
  opening_statement  = "Meet Nora 👋\nLet's bring your next web project to life."
  suggested_questions = []
```

Dify's own chat UI shows the opening statement and no question chips either, and our `/api/ai/config`
(same Dify app, service API) reports `suggestedQuestions: []` — so this was never a frontend mapping bug.
The frontend is ready and Dify-driven: it renders however many questions Dify returns (verified with 2
mock questions, which appeared as chips and matched Dify's text exactly), and hides the whole section when
the list is empty. Nothing is invented — the old hardcoded questions are gone
(`DEFAULT_AI_UI_CONFIG.suggestedQuestions = []`). Add the questions in Dify (the same settings panel as
the opening statement) and they appear after the config cache expires.

## 4. The empty state is now a real hero, not a chat bubble

The opening message is rendered from configuration in a dedicated centred area: 88 px round avatar,
Nora's name under it, the opening message under the name, then one prompt chip per Dify question — centred
horizontally and vertically in the chat viewport, with the fallback layer keeping it stable while the
avatar loads. Confirmed on 360×560, 390×844, 768×1024 and 1280×800: avatar centred, composer always
visible, no horizontal overflow; on the short screen the hero scrolls and every chip stays reachable.

The opening message is never added to the message list and no fake assistant row is written to the
database — the transcript only ever contains real `/api/ai/chat` exchanges. Clicking a chip sends it
exactly once through the normal flow and transitions to the chat state (verified: 1 user bubble, 1
assistant bubble, cache holds 2 messages).

## 5. How the 5-minute caches work

**Config cache** — `sessionStorage["ai-project-assistant-config"]`, `{version, config, cachedAt}`, TTL
300 s. Within the TTL, `loadAiUiConfig()` returns the cached copy and **no `/api/ai/config` request is
made** (verified: 1 request on the first visit, 0 on navigation and reload). Beyond the TTL the entry is
stale: it is still rendered immediately through a `useSyncExternalStore` store (so the header and hero
never flash "Project assistant") while a single background refresh replaces it. Server-side there is a
second, independent 300 s layer (`unstable_cache` + `s-maxage=300`).

**History cache** — `sessionStorage["ai-project-assistant-history"]`, `{version, sessionId, messages,
cachedAt}`, TTL 300 s, separate from the config cache. Fresh → rendered immediately, **no history
request** (verified: 0 on client-side navigation and on a full reload). Stale → rendered immediately as
well, then exactly one silent background refresh (verified: 1 request, and the message count stayed 2 —
no duplicates), and only if nothing was appended meanwhile, so a reply in flight is never clobbered. No
skeleton and no "loading" text in either case; the skeleton appears only when there is a stored session
and no usable cache at all. The cache is written after a send and after the reply (optimistic `local-`
messages are never persisted, which is what makes merging duplicate-safe), and cleared on new chat and on
delete — the deleted conversation does not come back, including after a reload.

## 6. `<think>` blocks are still removed before rendering

Unchanged and re-verified. `stripInternalReasoning()` (`src/lib/ai/response-text.ts`) runs at both
boundaries: server-side in `parseDifyAnswer()` (so reasoning never reaches the database or the response)
and at render time in `MessageText` (so cached and legacy rows cannot leak it either). It removes
complete blocks (multiline, any case, repeated, stray closers, truncated), then unwraps known JSON
transports, without touching legitimate braces or the `{"message":…,"action":…}` CTA envelope. Live reply
rendered with `thinkLeak: false`; the render boundary also proved itself on an artificially seeded row
containing `<think>legacy internal reasoning…</think> Legacy visible answer.` → only
"Legacy visible answer." was displayed.

## 7. Header

Still exactly `← Nora`: icon-only back link (no "Back" text, still navigates), Dify's name as the `h1`,
no subtitle, nothing hardcoded — verified on the live deployment (`headerText: "← | Nora"`, `subtitlePresent: false`).

## 8. Confirmation: Dify remains the source of truth

Nothing about Nora is hardcoded as the primary source: name, avatar/icon (image or emoji), opening
message, suggested questions and input placeholder all come from `GET /v1/site` + `GET /v1/parameters`.
`configSource` reports `dify` when Dify answered and `fallback` when it did not, so a missing
`DIFY_API_URL`/`DIFY_API_KEY` in a deployment is immediately visible; the neutral fallback keeps the page
usable and (per spec) never invents questions. Previously proven end-to-end: changing only Dify's values —
no website edit — changed the header, avatar, welcome message and chips.

## 9. Test results

| Area | Result |
| --- | --- |
| Avatar: broken Dify URL | falls back to `/api/ai/avatar` and **loads** (200 `image/png`, hero 88 px, header + message avatars) |
| Avatar: working / relative / emoji | used directly / resolved to the Dify origin / emoji rendered, no `<img>` |
| Hero | avatar 88 px centred, name, Dify opening message, Dify chips — on 360×560, 390×844, 768×1024, 1280×800 |
| Suggested questions | rendered from Dify (2 mock questions matched exactly); hidden when Dify returns none |
| Chip click | sent once, thinking indicator shown, then 1 user + 1 assistant message, cache 2 messages |
| History cache (fresh) | 0 history requests on navigation and on reload, conversation intact |
| History cache (expired) | rendered instantly, 1 silent refresh, still 2 messages (no duplicates) |
| New chat / delete | state and caches cleared, hero restored, deleted conversation never returns (checked after reload) |
| `<think>` | multi/multiline/case/partial cases stripped server- and client-side; live reply clean |
| Header | `← Nora`, no "Back", no subtitle |
| `tsc --noEmit` / `eslint` / `next build --webpack` | exit 0 / exit 0 / **Compiled successfully** (`/ai-assistant`, `/api/ai/avatar` present) |

Live-deployment checks (after deploying the changes) on
`https://shakib-shahriar.vercel.app/ai-assistant`:

| Check | Result |
| --- | --- |
| `/api/ai/config` | new shape, `avatarUrl` + `avatarProxyUrl` + `avatarFileId`, `configSource: "dify"` |
| `/api/ai/avatar` against real Dify | `200 image/webp`, 25 052 bytes |
| Hero on the live page | header `← Nora`, opening message, avatar 88 px centred, **Nora's real avatar loaded (1024 px)**, `brokenImages: 0` |
| Avatar beside Nora's reply | 28 px, loaded |
| Real message through Dify/Groq | thinking indicator, reply rendered, `thinkLeak: false` |
| Re-enter within the TTL | conversation restored, `historyRequests: 0`, `configRequests: 0` |
| Delete + re-check | deleted, hero restored, nothing resurrected |

One extra fix came out of this: Next's data cache outlives a deployment, so the pre-change config payload
(old field names) was still being served to the new code and the client was falling back to the local
defaults. The cache key now carries a shape version and a payload whose fields do not match the current
`AiUiConfig` is ignored in favour of a direct Dify read.

## 10. Remaining issues

1. **Dify has no suggested questions configured** — the section stays hidden; add them in Dify's app
   settings (the same panel as the opening statement) to see chips. Nothing to change in the code.
3. **Not verified against live Dify/Groq/Supabase** — no credentials in this environment, so those two
   services were simulated locally; the website code under test is the real thing.
4. **No physical Android device** — keyboard behaviour verified via the visual-viewport resize path and
   mobile emulation (touch enabled), not on hardware.
