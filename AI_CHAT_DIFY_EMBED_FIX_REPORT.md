# Fix: Dify embedded chatbot had no message composer / Send button on `/ai-assistant`

**Scope of change:** 2 files (`src/lib/ai/dify-embed.ts`, `src/components/ai/dify-chatbot.tsx`).
`tsc --noEmit` exit 0 · `next build --webpack` exit 0 · `eslint` exit 0 · `/api/ai/context`, `globals.css`,
`layout.tsx`, `next.config.ts`, `package.json`, Supabase schema and the Dify Chatflow are untouched
(verified with `git diff --exit-code`).

---

## 1. Actual root cause

The widget never initialised on the page. Not "the composer is hidden" — the whole Dify widget
(bubble button *and* the iframe window that contains the composer and Send button) was never created.

`embed.min.js` ends with:

```js
document.addEventListener("keydown", b),
y?.dynamicScript ? e() : document.body.onload = e     // y = window.difyChatbotConfig
```

So the initialiser `e()` runs **immediately** only when `difyChatbotConfig.dynamicScript` is truthy.
Otherwise it is parked on `document.body.onload` — the one-shot window `load` event.

That is fine for Dify's official snippet, which puts `embed.min.js` in the document with `defer`, so the
script executes during the initial parse and the later `load` event still reaches it. Next.js cannot do
that: `next/script strategy="afterInteractive"` appends the script from a React effect **after hydration**
(`node_modules/next/dist/client/script.js` → `loadScript()` inside `useEffect`), and on client-side
routing no new `load` event ever fires. The one-shot handler is therefore registered too late (or never
fires at all) and `e()` never runs.

`window.difyChatbotConfig` **was** set correctly — the problem was never the config object, the token,
the baseUrl, the script id or the CSS.

### Proof (controlled experiment, headless Chrome, same token)

| # | How the script is injected | `dynamicScript` | Widget created? |
| --- | --- | --- | --- |
| A | official snippet: static `<script … defer>` in the document | – | **yes** |
| B | appended from JS *after* the `load` event (= what `next/script` does) | – | **no** (no button, no iframe) |
| C | same as B | `true` | **yes** |
| D | appended *before* the `load` event | – | **yes** |

Measured on the running app, mobile viewport 390×844, **before** the fix:

```
/ai-assistant (localhost)                 → hasButton: false, hasWindow: false (no widget DOM)
https://shakib-shahriar.vercel.app/ai-assistant → hasButton: false, hasWindow: false (same failure live)
```

### Things that were checked and are fine

- **Token / baseUrl** — `JJJAG3buEHt2zB4O` on `https://udify.app` is valid. Loading
  `https://udify.app/chatbot/JJJAG3buEHt2zB4O` directly renders the real app: app name *Nora*, a composer
  with `placeholder="Talk to Nora"` and a `button[aria-label="Send"]`. Nothing was changed here.
- **Script id / order** — `id` = token, config inline script emitted before the embed script, matching
  Dify's snippet.
- **Duplicate initialisation** — not a factor. Dify guards the button with
  `document.getElementById(BUBBLE_BUTTON_ID) || create()`, and Next.js only injects each script once per
  `id`/`src`.
- **Scoped CSS** — it did not hide the composer. It did force an exact `height` / `width` with
  `!important` onto Dify's iframe, which is what risks clipping the bottom of the widget on short
  viewports; that is now removed (see below).
- **React/Next client rendering** — the config script executes synchronously when appended, so the config
  is always in place before `embed.min.js` runs. Ordering was not the bug.

---

## 2. Exactly what was changed

### `src/lib/ai/dify-embed.ts`

- Added `DIFY_EMBED_DYNAMIC_SCRIPT = true` with the reason documented inline.
- Added `DIFY_BUBBLE_*` id constants were kept as-is; token/baseUrl/script id unchanged.

### `src/components/ai/dify-chatbot.tsx`

1. **`dynamicScript: true`** in both `window.difyChatbotConfig` and the inline config script — the actual
   fix. Initialisation no longer depends on the `load` event, so the widget boots on a fresh load **and**
   on client-side navigation.
2. **Official embed structure kept**: inline config script (`id="dify-chatbot-config"`) followed by
   `<Script id={token} src="https://udify.app/embed.min.js" strategy="afterInteractive" />`. Dify owns the
   entire interface — no custom input, no custom Send button, no custom history.
3. **Removed the display fighting** (`setButtonHidden`, `display: none !important` toggling of Dify's own
   elements). It fought Dify's internal show/hide state and could hide the widget after a re-render. The
   widget is never removed or recreated; opening/closing is Dify's own toggle.
4. **Auto-open** now just polls briefly for Dify's bubble button and clicks it once (and closes it again on
   unmount so an open window is not left hanging on another route).
5. **CSS reduced to the minimum, no clipping**: safe-area and colour go through Dify's own supported
   variables (`--dify-chatbot-bubble-button-bottom/right/bg-color`). The iframe keeps only
   `bottom: 3.5rem !important` (lifts the window clear of the bubble button, which would otherwise sit over
   the composer/Send area) and a `dvh`-based `max-height`. The forced `height` / `width` were **removed**,
   so Dify sizes the window itself and the bottom composer can no longer be cut off.

---

## 3. Verification

Measured with headless Chrome driving the real page (392/390 px mobile emulation, touch events enabled)
and reading inside the cross-origin Dify iframe over the DevTools protocol.

| Check | Result |
| --- | --- |
| `tsc --noEmit` | exit 0 |
| `next build --webpack` | exit 0, `/ai-assistant` still static (`○`) |
| `eslint` on the changed files | exit 0 |
| Embed script loads / widget boots | **yes** — `#dify-chatbot-bubble-button`, `#dify-chatbot-bubble-window` (iframe, `src=https://udify.app/chatbot/JJJAG3buEHt2zB4O?`) |
| Client-side Dify init errors | **none** — no console errors/warnings on the page or inside the iframe |
| Message input visible | **yes** — `textarea[placeholder="Talk to Nora"]`, visible |
| Send button visible | **yes** — `button[aria-label="Send"]`, visible, enabled once text is typed |
| Real test message sent | **yes** — "What services do you offer?" |
| Real Dify response received | **yes** — *"I build custom websites, web applications, and e‑commerce solutions tailored to each client's needs. I also offer ongoing maintenance, SEO optimization, and branding support…"* |
| Conversation continuation | **yes** — second message ("And how much does a simple website cost?") answered with both turns kept in the transcript |
| Opening message / suggested questions | nothing rendered — this Dify app has none configured. Dify renders them automatically if they are ever added in Dify; no site change is needed |
| `/api/ai/context` unchanged | `git diff --exit-code` clean; live endpoint still answers `401 {"success":false,"error":"Unauthorized."}` without the secret |
| Open / close the widget | both work (Dify's own toggle) |
| No duplication after React navigation | **yes** — after `/ai-assistant` → `/` → `/ai-assistant` (client-side), still exactly 1 button, 1 window, 1 udify iframe |
| Migration architecture intact | unchanged: page → official Dify embed → Dify Chatflow → HTTP Request → `/api/ai/context` → Supabase → LLM → Dify |

Viewport matrix (widget opens, fits the viewport, no horizontal overflow, composer and Send button on
screen):

| Viewport | Widget fits | Composer visible / on screen | Send on screen | Horizontal overflow |
| --- | --- | --- | --- | --- |
| 360×640 | yes | yes (bottom 498 ≤ 640) | yes | no |
| 390×844 | yes | yes (bottom 702 ≤ 844) | yes | no |
| 412×915 | yes | yes (bottom 773 ≤ 915) | yes | no |
| 768×1024 | yes | yes (bottom 882 ≤ 1024) | yes | no |
| 1280×800 | yes | yes (bottom 658 ≤ 800) | yes | no |

Safe-area is respected through Dify's own variables
(`--dify-chatbot-bubble-button-bottom: max(1rem, env(safe-area-inset-bottom))`), and the window's height is
capped with `100dvh` so it always fits the *visible* viewport rather than the large viewport.

---

## 4. Not verified here (and why)

1. **A real Android device / real soft keyboard.** No Android hardware or remote device is reachable from
   this environment, so "the keyboard does not hide the composer" cannot be empirically confirmed.
   What *was* confirmed: the composer and Send button sit inside the visible viewport and are on screen at
   every tested mobile size, the window is capped to `100dvh` (dynamic, i.e. keyboard/URL-bar aware), no
   `!important` height can clip the bottom, and there is no horizontal overflow. This is the closest
   structural guarantee available without a device — please still tap the composer once on an Android
   phone to confirm the keyboard case.
2. **Observing Dify's outbound call to `/api/ai/context`.** That node lives inside the Dify Chatflow and its
   execution is not observable from this environment. Indirect evidence: the endpoint is deployed and
   still rejects unauthenticated calls, its file is byte-identical, and the live answer contained real
   service/pricing content of the shape produced by the context-fed LLM step.
3. **Token validity via public API.** `udify.app/api/parameters` returns `App token is missing.` for *any*
   token (a known-good public token behaves identically), so it cannot be used to validate a token. The
   token was instead validated by rendering the app itself, which is stronger evidence.

---

## 5. Status

- Root cause: **Dify's `embed.min.js` initialises on the one-shot window `load` event, which
  `next/script afterInteractive` (and any client-side navigation) misses** → widget never booted → no
  composer, no Send button.
- Fix: `dynamicScript: true` (plus removing the display/height overrides that fought Dify).
- Official Dify embed: **now fully functional**; Dify owns the interface and the conversation.
- Message sending: **tested successfully against the real Dify app**, with a real reply and continued
  conversation.
- Android: **structural checks passed, real-device/soft-keyboard test still recommended** (see 4.1).
- Remaining issues: none known. The Dify app simply has no opening statement or suggested questions
  configured — a Dify setting, not a bug.

The working tree contains the fix, uncommitted, so it can be reviewed before it is committed or deployed.
