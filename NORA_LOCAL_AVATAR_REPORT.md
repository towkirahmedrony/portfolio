# Nora's avatar is now local (`/images/nora.webp`)

The picture is served from our own `public/` directory on both surfaces, so it paints with the first
render. Everything else about Nora — name, opening message, suggested questions, input placeholder — is
still loaded from Dify through `/api/ai/config`, cache included.

## Files changed

| File | Change |
| --- | --- |
| `public/images/nora.webp` | **added** (25 052 bytes, 1024×1024 WebP) — see note 1 |
| `src/components/ai/assistant-avatar.tsx` | rewritten: renders `/images/nora.webp`; no Dify URL, no proxy, no emoji/URL fallback chain |
| `src/components/ai/ai-assistant-fab.tsx` | one line: `<AssistantAvatar size={52} />` (no config prop) |
| `src/components/ai/project-assistant.tsx` | avatar call sites no longer take config; dropped the now-unused `AiUiConfig` type import |
| `NORA_LOCAL_AVATAR_REPORT.md` | this report |

`git diff --exit-code` is clean for `globals.css`, `layout.tsx`, `/api/ai/context`, **`/api/ai/config`**,
`/api/ai/chat`, `/api/ai/avatar`, `src/lib/ai/client.ts` (config **and** history caches), `src/lib/ai/ui-config.ts`,
`src/app/ai-assistant/page.tsx`, `supabase/`, `package.json` and `next.config.ts`. The Dify Chatflow is untouched.

## What changed, exactly

`AssistantAvatar` was the single shared implementation already used by the floating launcher (52 px), the
chat header (40 px), the hero (88 px) and Nora's message bubbles (28 px). It now renders:

```tsx
<img src="/images/nora.webp" width={size} height={size} className="h-full w-full object-cover" … />
```

- **No Dify dependency.** `config.avatarUrl`, `avatarProxyUrl`, `avatarEmoji` and `avatarType` are no longer
  read by any component. `/api/ai/config` still returns them (its behaviour was left untouched on purpose),
  but nothing renders them.
- **No placeholder flash.** The previous fallback layer *underneath* the image (the generic bot mark) is
  gone, so nothing is drawn before the photo — and because the file is local there is no request to wait
  for. The only remaining fallback fires on an image **error** (the asset unreadable/replaced with a broken
  file) and swaps in the existing `AssistantIcon`.
- **A plain `<img>` on purpose.** It needs no image-optimiser round trip, which is what keeps the first
  paint immediate; nothing in the global Next.js image configuration had to change.

Unchanged and still Dify-driven: `name`, `openingMessage`, `suggestedQuestions`, `inputPlaceholder`,
`themeColor` (via the existing config store + `loadAiUiConfig()`, 5-minute cache), the floating launcher's
green pulsing dot, its welcome bubble with `opening_statement`, its close/X button
(`sessionStorage["nora-welcome-dismissed"]`), its link to `/ai-assistant`, the chat page's hero/composer/
history behaviour and the `<think>` stripping.

## Verification

Run against the production build with **Dify's icon deliberately broken** (`icon_url` that cannot be
decoded *and* the file-preview endpoint disabled) — the strongest proof that the avatar no longer depends
on Dify:

| Check | Result |
| --- | --- |
| Homepage avatar | `src=/images/nora.webp`, loaded, `localAvatarCount 1` |
| Homepage: Dify avatar usage | `remoteAvatarCount 0`, `/api/ai/avatar` requests **0** |
| Homepage: no placeholder | `genericBotIconInFab: false` — the bot mark is never rendered |
| Online dot | 12 px, `animation-name: ping` |
| Welcome bubble | Dify's text "Hi! How can I help you with your next project?", inside the viewport, no overflow |
| X / close | dismisses the bubble only, `sessionStorage["nora-welcome-dismissed"]="true"`, avatar still loaded |
| Click → chat | `/ai-assistant`, composer present |
| Chat page avatar | hero `/images/nora.webp` at 88 px, header 40 px — both loaded, `genericBotIconInHero: false` |
| Chat page: Dify avatar usage | `remoteAvatarCount 0`, `/api/ai/avatar` requests **0** |
| Assistant message avatar | `/images/nora.webp` at 28 px, loaded, after a real reply |
| Still Dify-driven | `configRequests: 1` per visit (shared cache), name "Nora", opening message rendered, placeholder "Ask about a website or web app…", header `← Nora` |
| Chat still works | reply received, `thinkLeak: false`, history cache still holds its messages |
| `tsc --noEmit` / `eslint` / `next build --webpack` | exit 0 / clean / **Compiled successfully** |

## Notes

1. **`public/images/nora.webp` did not exist** — `public/images/` was absent and there was no `.webp`
   anywhere in the repository. Rather than ship a broken image reference, I saved the picture the site was
   already serving for Nora (the same 1024×1024 WebP, 25 052 bytes) to exactly that path. Drop in any
   preferred file at `public/images/nora.webp` to replace it — no code change needed.
2. `/api/ai/avatar` (the Dify avatar passthrough) is now unused by the UI. It was left in place because
   removing it would mean touching an endpoint you asked not to modify; it can be deleted later if you want
   the endpoint surface trimmed.
3. `/api/ai/config` still returns Dify's avatar fields (untouched); if you would rather it stopped, that is
   a one-function change in `ui-config.ts`, but it is not required for the local avatar.
