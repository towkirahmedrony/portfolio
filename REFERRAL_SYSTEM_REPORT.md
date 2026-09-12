# Referral System — Implementation Report

Target project: Supabase `gbxfpnqdqbeohkfsqnyk` ("Portfolio", ap-southeast-1)
App: Next.js 16.3.4 + `@supabase/ssr`, site URL `https://shakib-shahriar.vercel.app`

## 1. Live database inspection (source of truth)

Inspected via the connected Supabase MCP server (read-only tools plus
`execute_sql`). No migration was replayed, nothing was reset, `supabase db push`
was not used, and no table was recreated.

Findings that shaped the implementation:

- `referral_codes`, `referrals`, `referral_rewards`, `referral_settings` already
  existed with the documented columns. No duplicate table was created.
- Existing referral objects reused as-is: `ensure_referral_code(uuid)`,
  `generate_referral_code()`, `admin_update_referral_settings(...)`,
  `handle_new_user()` (already created a referral code for every new user).
- `referral_codes` index `referral_codes_code_key` already guaranteed unique codes.
- `referrals` had **no** uniqueness on `referred_client_id`; `referral_rewards`
  had **no** uniqueness on `referral_id`. Live data: 0 referrals, 0 rewards,
  1 code, 1 settings row — so no pre-existing conflicts.
- `prepare_project_request()` (BEFORE INSERT on `project_requests`) sets
  `status='new'`, `submitted_at`, `updated_at`, generates `request_number`,
  requires a phone, and **clears `referral_code_id`**.
- `client_respond_to_quote()` and `admin_convert_project_request()` both create
  the project and already set `referrals.first_project_id`.
- Nothing anywhere set `referrals.project_request_id`, and nothing qualified a
  referral or created a reward. That was the actual gap.
- Qualification event: `project_status` is the existing enum and `completed` is
  the existing "successfully finished" state. No new status was invented.
- `referral_status` = pending|qualified|reward_pending|reward_available|completed|cancelled|invalid
- `reward_status` = pending|available|redeemed|expired|cancelled
- `discount_source_type` already contains `referral`.
- Trusted project amount = `projects.agreed_price`, which the quote-acceptance
  flow sets from the accepted quote total.
- Existing admin UI already read/wrote referral settings through
  `admin_update_referral_settings`, so no admin work was needed.

## 2. Files changed

| File | Change |
|---|---|
| `supabase/migrations/20260912120000_referral_system.sql` | new — constraints + functions + triggers |
| `supabase/migrations/20260912123000_referral_function_grants.sql` | new — tighten EXECUTE grants |
| `supabase/migrations/20260912140000_referral_claim_on_conflict_fix.sql` | new — fix found during live verification |
| `src/lib/referral-code.ts` | new — pending-referral cookie, link builder, code normalisation |
| `src/lib/profile.ts` | `buildCustomerReferral` rewritten to be fully DB-driven |
| `src/types/profile.ts` | extended `CustomerReferral`, `ReferralHistoryItem`, added `ReferredCustomerReferral` |
| `src/types/database.ts` | added the new RPC signatures |
| `src/types/referral.ts` | **deleted** — it existed only to hardcode 5%/2% in the frontend |
| `src/lib/project-request.ts` | removed the dead, hardcoded `buildProjectReferralPayload` |
| `src/lib/referral-rules.ts` | comment corrected (no longer claims to drive customer values) |
| `src/components/auth/signup-form.tsx` | capture `?ref=`, cookie, auth metadata, claim, "Referral applied" |
| `src/app/auth/callback/route.ts` | claim the pending referral after email-verification / OAuth |
| `src/app/profile/page.tsx` | ensure code, expire rewards, load settings + referred-side row |
| `src/components/profile/referral-section.tsx` | link, copy, Web Share, stats, per-referral detail |

Not touched: `globals.css`, `layout.tsx`, theme/config, admin pages, unrelated UI.

## 3. Database objects added

**Integrity (all verified conflict-free against live data first)**

- `referrals_referred_client_uidx` — unique on `referrals(referred_client_id)` where not null
- `referrals_no_self_referral` — `CHECK (referred_client_id is null or referred_client_id <> referrer_id)`
- `referral_rewards_referral_uidx` — unique on `referral_rewards(referral_id)`
- `project_discounts_referral_uidx` — unique on `project_discounts(project_id, source_id)` where `source_type='referral'`

**Functions**

- `create_referral_for_client(p_client_id, p_code)` — internal worker. Validates existence, `is_active`, expiry, self-referral, program settings, referrer status; snapshots the percentages; idempotent.
- `claim_my_referral(p_code)` — `auth.uid()`-scoped wrapper.
- `ensure_my_referral_code()` — `auth.uid()`-scoped wrapper that guarantees an active code exists.
- `expire_referral_rewards()` — retires rewards past `expires_at`.
- `attach_referral_to_project_request()` — AFTER INSERT on `project_requests`.
- `apply_referral_to_project()` — AFTER INSERT on `projects`.
- `qualify_referral_on_project()` — AFTER UPDATE OF `status` on `projects`.
- `handle_new_user()` — replaced; still creates the profile and the code exactly as before, and additionally applies `raw_user_meta_data->>'referral_code'` inside its own exception block.

**Grants** — every new function is `SECURITY DEFINER` with `set search_path to 'public'`. `create_referral_for_client` is service/postgres-only; `ensure_referral_code(uuid)` was previously executable by `PUBLIC`/`anon` and is now service/postgres-only (it accepted an arbitrary profile id, which is exactly the "unnecessary privileged functionality" to avoid).

## 4. Lifecycle implemented

1. **Code** — every customer gets a code from the existing `handle_new_user` trigger; `ensure_my_referral_code()` covers accounts without one. Link is built from `site.url` and the real `referral_codes.code`: `https://shakib-shahriar.vercel.app/signup?ref=<code>`.
2. **Capture** — `/signup?ref=X` normalises the value, writes a short-lived `pending-referral` cookie, and passes it as `options.data.referral_code`.
3. **Creation** — `handle_new_user` calls `create_referral_for_client`, so the row is created atomically at signup with `referrer_id = referral_codes.owner_id`, `referred_client_id = new user`, `project_request_id`/`first_project_id` null, `status='pending'`, and the two percentages snapshotted from `referral_settings`. Invalid, expired, inactive, self-referral and paused-program cases simply return null.
4. **Rejection safety** — every rejection path returns null; signup continues normally. A referral failure can never block account creation.
5. **Request association** — an AFTER INSERT trigger on `project_requests` sets `referrals.project_request_id` and, only if that row was actually claimed, `project_requests.referral_code_id`. `prepare_project_request()` still nulls any browser-supplied value, so the browser can never choose the referrer.
6. **Discount** — when the first project is created, the trigger writes exactly one `project_discounts` row with `source_type='referral'`, the stored `client_discount_percent` snapshot, and an amount computed from the trusted `projects.agreed_price`.
7. **Qualification** — only when the project reaches the existing `completed` status. Then exactly one `referral_rewards` row is created with `reward_type='referral_discount'`, `reward_percent` from `referrals.referrer_reward_percent`, `status='available'`, `available_from=now()`, and `expires_at` derived from `reward_validity_days` (null when unset).
8. **Minimum amount** — `minimum_project_amount` is read at qualification time; if the first project is below it, the referral is marked `qualified` and **no reward** is created.
9. **Cancellation** — cancelling the first project cancels any unredeemed reward; if no reward was ever earned, the first-project slot is released so a later project can still qualify.
10. **Second project** — `first_project_id` is already set, so no second discount and no second reward can ever be produced.

## 5. Security / RLS result

RLS was **audited and left unchanged** — the existing policies already implement the required model, so nothing was weakened:

- `referral_codes` — SELECT where `owner_id = auth.uid()`
- `referrals` — SELECT where `referrer_id = auth.uid()` OR `referred_client_id = auth.uid()`
- `referral_rewards` — SELECT where `referrer_id = auth.uid()`
- `referral_settings` — SELECT true for authenticated; admin ALL
- Admin access via the existing `is_admin()` / `is_active_admin()` policies

Customers have no INSERT/UPDATE/DELETE policy on any referral table, so `referrer_id`, `referred_client_id`, percentages and reward status are server-owned. `get_advisors` reported no new security lints (`project_discounts`/`notifications` etc. "RLS enabled, no policy" are pre-existing).

## 6. Tests performed against the real database

Both suites ran inside transactions that were **rolled back**, so no test data remains.

**Lifecycle** — all PASS:

| Check | Result |
|---|---|
| Code created for new users | pass |
| Referral created automatically at signup | 1 row |
| `referrer_id` = `referral_codes.owner_id` | pass |
| Snapshot equals current settings | pass |
| Repeat claim creates no duplicate | pass |
| Invalid code rejected | pass |
| Self-referral rejected | pass |
| Request sets `referrals.project_request_id` + `project_requests.referral_code_id` | pass |
| First project → 1 referral discount row at 5% (snapshot) | pass |
| Reward exists only after completion | 0 → 1 |
| Duplicate completion event → still exactly 1 reward | pass |
| `reward_percent` = `referrals.referrer_reward_percent` | pass |
| Second project → no new reward, no discount | pass |
| Below `minimum_project_amount` → no reward | pass |
| Referred client sees only their own referral | 1 row |
| Unrelated customer sees 0 referrals and 0 rewards | pass |
| Referrer sees their own referrals and reward | 2 / 1 |

**RLS write protection** — all PASS: a referred customer could not change `referrer_reward_percent`, `status` or `referrer_id`; could not re-own another user's code row; and inserting a forged referral row was rejected.

**Build checks** — `tsc --noEmit` clean; `eslint src` 0 errors (one pre-existing warning in the untouched `src/lib/admin-quote-constants.ts`); `next build --webpack` succeeded.

### Bug found and fixed by verification

The first live run failed with `42P10: there is no unique or exclusion constraint matching the ON CONFLICT specification`. `create_referral_for_client` used `on conflict (referred_client_id)` while the matching index is **partial**, so every referral creation at signup would have raised. Fixed by repeating the predicate (`on conflict (referred_client_id) where referred_client_id is not null do nothing`) and applied to the live database.

## 7. Remaining limitations

- **Reward amounts are not shown to customers.** `referral_rewards` stores only a percentage, and a referrer cannot read the referred client's project (RLS on `projects` is `client_id = auth.uid()`), so a monetary total is not derivable from the existing model. The UI shows percentages and states that amounts are settled by the team.
- **Reward redemption is display-only.** The app has no redemption action and no code sets `redeemed_at`/`redeemed_project_id`; none was invented. Expiry is enforced in the database by `expire_referral_rewards()` and in the profile view.
- **Below-minimum first project consumes the first-project slot.** The referral is marked `qualified` with no reward and no later project can earn one. Documented rather than guessed at.
- **`referral-rules.ts` retains 5/2 as admin-form seed values** mirroring the DB column defaults. Customer-facing and reward-computing paths never read them; a live settings row always wins. Left in place to avoid changing admin UX.
- **A suspended referrer still receives their already-earned reward.** This is deliberate: suspension is an account state enforced elsewhere, and deleting a referrer cascades the referral away.
- **Test data path not exercised through the real UI** (no browser run, and no `.env` in the workspace). Verification drove the database directly; the frontend was verified by typecheck, lint and a production build.
