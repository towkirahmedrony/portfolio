# Custom full-screen AI Assistant rebuilt (Dify + Groq backend, no Dify widget)

`/ai-assistant` is a native part of the website again: the website owns the chat UI and history, Dify
owns the workflow, Groq stays the LLM. The Dify bubble/embedded widget is gone.

Flow now in place (unchanged at the edges):

```
Custom chat UI (/ai-assistant)
  -> POST /api/ai/chat            (website sessions + history, NDJSON)
     -> Dify Chat API             (server-side, Bearer DIFY_API_KEY)
        -> Dify Chatflow
           -> POST /api/ai/context   (untouched, live Supabase data)
              -> Supabase
           -> Groq LLM
  -> GET  /api/ai/config          (server-side Dify /site + /parameters, 5 min cache)
  -> DELETE /api/ai/chat          (website session + Dify conversation)
```

---

## 1. What the previous migration had left behind

The repository was inspected before anything was written. The custom chatbot had not been deleted
cleanly — it had been **stubbed out** by the Dify-embed commit, while its supporting modules survived:

| File | State found | Recoverable? |
| --- | --- | --- |
| `src/lib/ai/client.ts` | 7 lines (`export {}`) | yes — 398-line version at `1d33947` |
| `src/components/ai/project-assistant.tsx` | 11 lines, just rendered the Dify widget | yes — 615-line version at `1d33947` |
| `src/components/ai/message-text.tsx` | 5 lines | yes — 58-line version at `37b761e` |
| `src/app/api/ai/chat/route.ts` | 17 lines, 404 | yes — 549-line Dify version at `97d388e` |
| `src/app/api/ai/config/route.ts` | 13 lines, 404 | yes — 17-line version at `1d33947` |
| `src/lib/ai/ui-config.ts` | intact (164 lines) | reused as-is |
| `src/lib/ai/ui-defaults.ts` | intact | reused as-is |
| `src/types/ai.ts` | intact (`AiUiConfig`, stream events) | reused as-is |
| `src/lib/ai/dify.ts`, `sessions.ts`, `errors.ts`, `cta.ts`, `links.ts` | intact | reused, extended |

**So the old custom chatbot was reused, not rebuilt from scratch.** The retired implementations were
restored from git and then extended with the piece that never existed: conversation deletion. No obsolete
Gemini code was restored (`gemini.ts`, `env.ts`, `context.ts` stay on disk unused, exactly as before; the
only Gemini leftovers edited were two error-code string literals in `client.ts`, now `"dify"`).

## 2. Files created, modified, removed

**Created**

- `AI_ASSISTANT_CUSTOM_UI_REPORT.md` (this report)
- New server capability in existing files (no new files needed):
  `deleteDifyConversation()` in `src/lib/ai/dify.ts`, `deleteChatSession()` in `src/lib/ai/sessions.ts`,
  `DELETE` handler in `src/app/api/ai/chat/route.ts`, `deleteAiConversation()` /
  `startNewAiConversation()` in `src/lib/ai/client.ts`.

**Modified**

| File | Change |
| --- | --- |
| `src/app/ai-assistant/page.tsx` | full-screen page renders the custom `ProjectAssistant` (`variant="page"`, `force-dynamic`) |
| `src/app/api/ai/config/route.ts` | restored: server-side `getAiUiConfig()`, `Cache-Control` for the 5-minute cache |
| `src/app/api/ai/chat/route.ts` | restored Dify chat bridge + new `DELETE` handler |
| `src/components/ai/project-assistant.tsx` | restored and extended: header menu (New chat / Delete chat) with confirmation dialog, welcome state with avatar, avatar beside Nora's messages, icon send button, centred desktop composer, generation guard so a late reply can never leak into a new conversation |
| `src/components/ai/message-text.tsx` | restored and extended: paragraphs, line breaks, bullet and numbered lists, plus the existing safe-link rendering |
| `src/lib/ai/client.ts` | restored + delete / new-conversation helpers, `"gemini"` fallback codes -> `"dify"` |
| `src/lib/ai/dify.ts` | `+ deleteDifyConversation()` (best-effort `DELETE /conversations/{id}`) |
| `src/lib/ai/sessions.ts` | `+ deleteChatSession()` |

**Removed** (recoverable: `gio trash` + still in git history)

- `src/components/ai/dify-chatbot.tsx` (the bubble widget component)
- `src/lib/ai/dify-embed.ts` (token, `embed.min.js` URL, embed CSS)
- `src/components/ai/project-assistant-section.tsx` (unused leftover that mounted the BubbleDify widget)

Not touched: `src/app/api/ai/context/route.ts`, `globals.css`, `layout.tsx`, Supabase schema/migrations,
auth, project-request, contact and portfolio/services code, the Dify Chatflow, `next.config.ts`,
`package.json` (no new dependency).

## 3. Dify now owns Nora's configuration

`GET /api/ai/config` is server-side only. It calls the Dify **service API** with `DIFY_API_URL` +
`DIFY_API_KEY` (Bearer, server-to-server only) and normalises two endpoints into the small safe payload:

- `GET /site` -> `title`, `icon`, `icon_type`, `icon_url` (avatar + name), `input_placeholder`
- `GET /parameters` -> `opening_statement` (welcome message), `suggested_questions`

Field names were taken from Dify's published OpenAPI spec (`openapi_service.json`), not guessed. Response
shape:

```json
{ "ok": true, "name": "…", "avatar": "…", "avatarType": "emoji|image",
  "welcomeMessage": "…", "suggestedQuestions": ["…"], "inputPlaceholder": "…", "themeColor": null }
```

Cached with `unstable_cache` for 300 s (`AI_UI_CONFIG_REVALIDATE_SECONDS`) and served with
`s-maxage=300, stale-while-revalidate=60`. If Dify is unreachable the loader falls back to
`DEFAULT_AI_UI_CONFIG`, so the page always works — and nothing about Nora's name, avatar, welcome message,
suggestions or placeholder is hardcoded as the primary source.

Live response from the run (mock Dify, real route):

```json
{"ok":true,"name":"Nora","avatar":"🌱","avatarType":"emoji",
 "welcomeMessage":"Hi! I'm Nora. Ask me about websites, web apps, pricing or how to start a project.",
 "suggestedQuestions":["How much does a website cost?","What kind of websites do you build?","Can you build a web app?","How do I start a project?"],
 "inputPlaceholder":"Ask about a website or web app…","themeColor":null}
```

## 4. History, new conversation, delete conversation

- **History**: the existing `ai_chat_sessions` / `ai_chat_messages` system, reconnected — not a second
  store. One cookie-scoped visitor identity (`ai_visitor_id`, httpOnly) plus optional auth; `GET
  /api/ai/chat?sessionId=` returns the last 24 messages. The session id is remembered in `sessionStorage`,
  so a refresh restores the conversation. Loading is silent: a small skeleton, no "loading" text.
- **Dify context**: the Dify `conversation_id` is stored on the assistant row in the existing
  `metadata` jsonb column (`dify_conversation_id`) — no schema change — and passed back on the next
  message, so the thread continues. Confirmed in the Dify request log: the second message carried
  `conversation_id: conv-1`.
- **New chat**: header menu -> clears the stored session id and all local state, shows Dify's welcome
  message and suggested questions again; the next message creates a fresh website session and therefore a
  fresh Dify conversation. A `generationRef` guard drops any in-flight reply from the previous thread, so
  old messages can never mix into the new one.
- **Delete chat**: header menu -> confirmation dialog ("Delete this conversation?" / Cancel / Delete) ->
  `DELETE /api/ai/chat`, which (1) re-resolves ownership exactly like GET/POST, (2) deletes the Dify
  conversation via `DELETE /conversations/{conversation_id}` with body `{ user }` (best effort, 404 treated
  as already gone, failures logged but never blocking), (3) deletes the website session — messages cascade
  — and (4) returns `{ ok: true }`. The UI then resets to the welcome state.

## 5. Verification

Everything below was run on the production build (`next build --webpack` output served by `next start`).
Because this environment has no Dify/Supabase credentials, the Dify service API and Supabase PostgREST were
replaced with faithful local stand-ins (mock Dify on `:4599`, mock PostgREST on `:4600`, chat reply delayed
900 ms to be realistic). The website's own code — routes, session storage, Dify client, UI — is the real
thing; only the two external services are simulated.

| Check | Result |
| --- | --- |
| `tsc --noEmit` | exit 0 |
| `eslint` (ai components, ai lib, ai routes, page) | exit 0 |
| `next build --webpack` | exit 0, `/ai-assistant` = `ƒ` dynamic |
| `/api/ai/config` | 200, all fields above, **no secrets** in the payload |
| Dify called by the server | `GET /v1/site`, `GET /v1/parameters`, `POST /v1/chat-messages`, `DELETE /v1/conversations/conv-1` — all with `Authorization: Bearer` server-side |
| Real message sent | yes — "How much does a website cost?" typed/clicked in the browser |
| Reply received and rendered | yes — reply text, 3 `<li>` bullet items, external link with `target="_blank" rel="noopener noreferrer"`, internal CTA "/start-project" |
| Conversation continuation | yes — second message carried `conversation_id: conv-1`; history shows both turns |
| Refresh behaviour | yes — user message + reply restored on reload, no "loading" text, no stuck skeleton |
| New chat | yes — welcome + chips back, previous reply and quoted question gone, sessionStorage cleared |
| Delete chat | yes — dialog shown, Cancel leaves everything intact, Delete removes it |
| Deleted conversation not visible | yes — welcome state restored, stale messages gone, `GET` -> 404 |
| Delete scoping | yes — with two conversations, deleting one left the other readable (2 messages) and only removed the target; a *different* visitor and a cookie-less caller both got 404 and nothing was deleted |
| Dify-side delete | yes — `DELETE /v1/conversations/conv-2` with `{ "user": "<session id>" }` |
| Thinking indicator | appears immediately after send ("Nora is thinking"), gone when the reply arrives, also gone on failure; never shown while loading config or history |
| Error handling | upstream 500 -> "Sorry, I'm having trouble responding right now. Please try again in a moment." + working **Retry** (a fresh Dify request was observed); no API key, Dify URL or stack trace in the page; no empty assistant bubble left behind |
| Dify embed removed | yes — `iframes: 0`, `[id^="dify-chatbot"]: 0`, `embed.min.js` not loaded, 0 `udify.app` references in the DOM |
| "Powered by Dify" | not present |
| Secrets | no `NEXT_PUBLIC_DIFY*` anywhere; `DIFY_API_KEY` only read server-side in `src/lib/ai/dify.ts`; client bundle contains none of the test secrets |
| `/api/ai/context` (+ `globals.css`, `layout.tsx`) | `git diff --exit-code` clean — byte-identical |

Layout, measured in headless Chrome (mobile emulation, touch enabled):

| Viewport | Root height | Composer fully visible | Horizontal overflow | Layout |
| --- | --- | --- | --- | --- |
| 390×844 | 844 | yes (bottom 832) | no | full-viewport, safe-area padding 12px |
| 1280×800 | 800 | yes (bottom 760) | no | messages and composer both in a 768 px centred column |

Keyboard behaviour (Android proxy: focused composer + viewport shrunk 844 -> 420): the shell tracks the
visual viewport (844 -> 420 -> 844), the composer stayed fully visible (bottom 408 <= 420) and focus was
kept.

## 6. Remaining issues

1. **No live Dify/Groq/Supabase run from this environment** — there are no credentials here (no `.env.local`),
   so the two external services were simulated as described. The website side is fully exercised; run one
   real message on the deployed site (and one delete) to confirm against the real Dify app.
2. **Real Android device not available** — keyboard behaviour was verified through the visual-viewport
   resize path and mobile emulation rather than a physical phone. Worth one tap-through on Android.
3. `src/lib/ai/gemini.ts`, `env.ts` and `context.ts` remain on disk with no importers (unchanged from
   before, deliberately not deleted here). `GeminiRequestError` in `errors.ts` is likewise unused. Safe to
   remove in a separate cleanup.
4. The Dify app itself has no opening statement or suggested questions configured in the live app; with
   Dify configured they render automatically because the fields are dynamic.

Working tree left uncommitted for review, then committed and pushed.
