# Homepage floating Nora assistant (teaser launcher)

The launcher is a **teaser only**: it shows Nora's Dify picture, an online dot and Dify's opening
message, and clicking it opens the existing `/ai-assistant` page, which owns the conversation. No second
chatbot, no second config, no new backend.

## Files changed

| File | Change |
| --- | --- |
| `src/components/ai/ai-assistant-fab.tsx` | rewritten: Dify avatar, pulsing online dot, dismissible welcome teaser |
| `src/components/ai/assistant-avatar.tsx` | **new** — the avatar (with its Dify URL → passthrough → emoji → local-mark fallback chain) extracted so the launcher and the chat page share one implementation |
| `src/components/ai/project-assistant.tsx` | only the avatar import changed (its local copy was deleted); no chat behaviour touched |
| `HOMEPAGE_NORA_LAUNCHER_REPORT.md` | this report |

`git diff --exit-code` is clean for `globals.css`, `layout.tsx`, `/api/ai/context`, `supabase/`,
`package.json`, `next.config.ts` and `src/app/ai-assistant/page.tsx`. The Dify Chatflow is untouched.

## Implementation

- **Dify remains the single source of truth.** The launcher reads `name`, `avatarUrl`/`avatarProxyUrl`/
  `avatarEmoji` and `openingMessage` from `/api/ai/config` through the *existing* config store
  (`subscribeAiConfigCache` / `getAiConfigCacheSnapshot`) and refreshes it with the existing
  `loadAiUiConfig()`. Nothing about Nora is hardcoded, and because both the launcher and `/ai-assistant`
  use the same 5-minute sessionStorage cache, one visit produces at most one `/api/ai/config` request.
- **Avatar.** The extracted `AssistantAvatar` tries Dify's URL, then the `/api/ai/avatar` passthrough,
  then Dify's emoji, then the local mark — rendered as a plain `<img>` over a fallback layer, so a failed
  load can never show a broken image or an empty circle.
- **Online dot.** A 12 px emerald dot at the avatar's bottom-right with a soft green glow, plus a
  `motion-safe:animate-ping` halo for the gentle pulse — pure CSS, no presence system, no DB field. It is
  never colour-only: the link carries `aria-label`/`title` "Chat with Nora" and an sr-only "Nora is online".
- **Welcome teaser.** Rendered above the avatar with a pointer toward it, rounded card, small X at the top
  right (`aria-label="Close message"`), and a caption with Dify's name over `opening_statement`. Shown only
  when the configuration actually came from Dify (`configSource === "dify"`), so the local fallback is
  never presented as Nora's welcome.
- **Dismissal.** Clicking X writes `sessionStorage["nora-welcome-dismissed"] = "true"` and hides *only* the
  teaser; the avatar stays visible and clickable. The flag is read through a tiny external store (so
  hydration stays deterministic) and persists for the browser session across navigation and reloads.
- **Navigation & animation.** The launcher is unchanged in behaviour: a `Link` to `/ai-assistant`, hidden
  on `/admin/*` and `/ai-assistant`. Motion is subtle — a slight hover scale and tap feedback on the
  avatar, the dot's pulse, and a short fade/slide-in for the teaser that reuses the site's existing
  `fade-up` keyframes.

## Verification (production build, 390 px unless noted)

| Check | Result |
| --- | --- |
| Avatar from Dify | 52 px inside a 56 px button, image loaded, **0 broken images** |
| No hardcoded avatar | config response carries Dify's URL; only the fallback mark is local |
| Online dot | 12 px, emerald, bottom-right of the avatar, `animation-name: ping` |
| Welcome without opening the chat | shown on `/` with Dify's opening text ("Hi! How can I help you with your next project? …") |
| Positioning | above the avatar, `max-w-[min(19rem,calc(100vw-2rem))]`, inside the viewport, pointer toward the avatar |
| X button | 28 px hit area, `aria-label="Close message"`, hides only the teaser |
| Dismissal persists | `nora-welcome-dismissed="true"`, still hidden after `/services` → `/` |
| Avatar after dismissal | still visible (56×56), still clickable |
| Click → chat | `/ai-assistant` with the composer present |
| Config cache | 0 additional `/api/ai/config` requests across navigation, reload and the chat page |
| Mobile 320 / 360 / 390 / 412 | no horizontal overflow, launcher inside the viewport, bubble 288–304 px wide, 20 px bottom gap above the safe area |
| Fixed while scrolling | stays in place at `scrollY 1200` |
| `prefers-reduced-motion: reduce` | teaser `animation-name: none`, pulse halo `display: none`, dot still visible |
| Avatar failure fallback | Dify URL broken *and* passthrough off → local mark, **0 broken images** on the page |
| Chat page regression | header `← Nora`, hero avatar 88 px, opening message, reply received, no `<think>` leak, composer visible |
| `tsc --noEmit` / `eslint` / `next build --webpack` | exit 0 / exit 0 / **Compiled successfully** |

## Notes

1. **`motion-reduce:animate-none` does not work for the site's own `animate-fade-up`** — `globals.css` is
   appended after the Tailwind utilities, so that class wins the cascade. The teaser therefore uses
   `motion-safe:[animation:fade-up_0.5s_ease-out_both]` instead, which is why reduced motion is genuinely
   honoured (verified: `animation-name: none`).
2. **The teaser appears on every public page the launcher is on**, not only `/` — it is the same global
   launcher that already existed, and it shows at most once per session. To restrict it to the homepage,
   add `pathname === "/"` to the `showWelcome` condition.
3. Not verified on a physical Android device (no hardware available here); the safe-area gap, viewport fit
   and reduced-motion behaviour were checked through mobile emulation.
