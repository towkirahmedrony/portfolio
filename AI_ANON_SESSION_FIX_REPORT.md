# Anonymous chat sessions failed from their second message — root cause and fix

**Files changed: `src/lib/ai/sessions.ts` only** (33 added lines, no deletions in behaviour).
**No schema change, no migration.** `/api/ai/context`, `/api/ai/chat`, the Dify workflow, the UI and the
caches are untouched.

## Root cause

Two code paths disagreed about the anonymous identity.

1. `createChatSession()` inserts `visitor_id` first, and **if that insert errors it silently falls back to
   an insert without it**, returning the row with `visitor_id: null`. Production is hitting that fallback:
   the live anonymous rows show `user_id` NULL and no visitor binding at all (the legacy `session_token`
   column is NULL too) while their messages save normally — that shape is only produced by the fallback
   branch, because the first insert is the only path that would have written the binding.
2. `loadOwnedSession()` then required, for an anonymous caller, `session.visitor_id === <ai_visitor_id
   cookie>` — a comparison that can never be true for such a row. It returned `null`, and every route that
   loads a session (POST, GET history, DELETE) answered **404 `Conversation not found.`**

That is exactly why message #1 worked and message #2 did not: message #1 creates a session without ever
looking one up, and from message #2 on the same row is re-loaded and refused.

**Not the cause: cookie persistence.** Reproduced on the live API with a cookie jar — `ai_visitor_id` was
set by request #1 and sent on request #2, and the lookup still failed. Also verified against a local
PostgREST stub: the cookie round-trip is correct.

## The fix

In `loadOwnedSession()`, the anonymous branch now accepts a row that carries **no stored visitor binding**
(root cause: the database never received it), while anything that *does* carry a binding is still compared
strictly:

```ts
if (!session.visitor_id) {
  return session;                       // anonymous row with no binding to verify
}
return session.visitor_id === input.visitorId ? session : null;   // unchanged, strict
```

Why this is the right shape of fix: the session id is a v4 UUID that is only ever handed to the browser that
created the conversation and is already how the client identifies its own chat, so an anonymous row with no
binding to check against stays usable instead of being permanently unreachable. Rows owned by a user account
are still refused on the anonymous path, and the logged-in branch (`if (input.userId) { … }`) is untouched.

**Trade-off, stated plainly:** on a database where the binding cannot be stored, an anonymous conversation
is protected by its unguessable session id rather than by session id *and* visitor cookie. The stricter
two-factor check remains in force wherever the binding exists (proven below). If you want the binding
enforced in production too, the column has to become writable — that is a schema change, which this fix
deliberately avoids.

## Verification

| Test | Result |
| --- | --- |
| Live, cookie jar: POST #1–#5 on one session | **all 200**, one session id, Dify continuity (`continued conv-N`) |
| Live, GET history for that session | 200, 10 messages (5 user + 5 assistant) |
| Live, DELETE then GET | 200 then 404 |
| Live, conversation created **before** the fix | history now 200 (repaired), then cleaned up |
| Live UI (fresh profile): 3 messages → refresh (history cache cleared) → continue → New chat | same session id throughout, real replies, no "Conversation not found", and New chat produced a **new** session id on purpose |
| Local, production condition (`visitor_id` insert rejected with 42703) | POST #1–#6 all 200, one session row (`visitor_id` absent), 12 messages, delete cascades |
| Local, healthy DB (insert accepted) | session stores `visitor_id`; same cookie 200; **different visitor cookie 404** → strict check intact |
| `loadOwnedSession` ownership unit test | **10/10** — own user ✓, other user ✗, anonymous onto a user row ✗, unbound anon ✓, bound anon matching ✓ / other cookie ✗, claim by a logged-in user ✓ |
| `tsc --noEmit` / `eslint` / `next build --webpack` | clean / clean / compiled |

**Logged-in flow:** unchanged code path, and the ownership unit test covers every logged-in branch
(own session allowed, another user's refused, anonymous caller refused, claim of an anonymous session
allowed). A live logged-in multi-message run was **not** possible here — no account credentials are
available in this environment.

## Notes

- The `createChatSession()` fallback is kept (without it, session creation would fail outright on the live
  database), now documented so the "anonymous but unbound" row shape is not mistaken for a bug again.
- Anonymous conversations created before this fix become usable again (verified: the earlier broken session
  loaded its history and was then deleted).
- No Dify credentials were exposed, no `NEXT_PUBLIC_*` added, and no RLS policy touched.
