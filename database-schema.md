# Database Schema — Agency / Client Platform

Backend: Supabase (Postgres). Source migration: `supabase/migrations/..._init_schema.sql`.
This file is a human/agent-readable reference — the `.sql` migration is the source of truth for actual DDL.

## Relationship overview

```
auth.users
    └── profiles
          ├── referral_codes
          │       └── referrals
          │               └── referral_rewards
          │
          ├── project_requests
          │       └── projects
          │              ├── project_requirements
          │              ├── project_milestones
          │              ├── project_notes
          │              ├── project_files
          │              ├── project_messages
          │              ├── quotes
          │              │     └── quote_items
          │              ├── project_discounts
          │              └── invoices
          │                    ├── invoice_items
          │                    └── payments
          │
          ├── notifications
          └── reviews
```

Business rule: new referred client gets a **5% discount** (`referral_settings.new_client_discount_percent`), referrer gets a **2% reward** on their next project (`referral_settings.referrer_reward_percent`).

## Enum types

| Enum | Values |
|---|---|
| `profile_role` | admin, client |
| `profile_status` | active, suspended, deleted |
| `request_status` | new, reviewing, quoted, approved, rejected, converted, cancelled |
| `project_status` | pending, approved, in_progress, on_hold, in_review, revision, completed, cancelled |
| `project_priority` | low, normal, high, urgent |
| `referral_status` | pending, qualified, reward_pending, reward_available, completed, cancelled, invalid |
| `reward_status` | pending, available, redeemed, expired, cancelled |
| `discount_source_type` | referral, reward, coupon, manual, promotion |
| `quote_status` | draft, sent, viewed, accepted, rejected, expired, cancelled |
| `milestone_status` | pending, in_progress, completed, skipped |
| `invoice_status` | draft, issued, partially_paid, paid, overdue, cancelled, refunded |
| `payment_type` | advance, milestone, final, full, refund |
| `payment_status` | pending, processing, succeeded, failed, cancelled, refunded, partially_refunded |
| `review_status` | pending, approved, rejected, hidden |
| `contact_status` | new, read, replied, archived, spam |
| `file_category` | design, logo, content, document, attachment, deliverable, other |

## Rollout phases

- **Phase 1 (core):** profiles, referral_settings, referral_codes, project_requests, projects, project_requirements, referrals, referral_rewards, project_discounts, quotes, quote_items, project_milestones, project_notes, project_messages, project_files, notifications
- **Phase 2 (payments):** invoices, invoice_items, payments, payment_events
- **Phase 3 (admin / CMS):** services, service_features, portfolio_projects, portfolio_project_images, reviews, contact_messages, audit_logs, notification_preferences

---

## Auth

### `profiles`
1:1 with `auth.users`. App-level user data — do not duplicate `auth.users` itself.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | = `auth.users.id`, on delete cascade |
| full_name | text | not null |
| display_name | text | |
| avatar_url | text | |
| phone | text | |
| company_name | text | |
| job_title | text | |
| role | profile_role | default `client` |
| status | profile_status | default `active` |
| email_verified | boolean | default false |
| created_at | timestamptz | |
| updated_at | timestamptz | auto-touched |
| last_seen_at | timestamptz | |

---

## Referral system

### `referral_settings`
Config table so discount/reward % can change without code changes.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| new_client_discount_percent | numeric | default 5 |
| referrer_reward_percent | numeric | default 2 |
| minimum_project_amount | numeric | |
| reward_validity_days | integer | |
| is_active | boolean | default true |
| created_at / updated_at | timestamptz | |

### `referral_codes`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| owner_id | uuid FK → profiles.id | on delete cascade |
| code | text | unique |
| is_active | boolean | default true |
| created_at | timestamptz | |
| expires_at | timestamptz | |
| used_count | integer | default 0 |

### `referrals`
Tracks the referrer → referred relationship.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| referrer_id | uuid FK → profiles.id | |
| referred_client_id | uuid FK → profiles.id | nullable |
| referral_code_id | uuid FK → referral_codes.id | |
| project_request_id | uuid FK → project_requests.id | nullable |
| first_project_id | uuid FK → projects.id | nullable |
| status | referral_status | default `pending` |
| client_discount_percent | numeric | |
| referrer_reward_percent | numeric | |
| created_at | timestamptz | |
| qualified_at / completed_at / cancelled_at | timestamptz | nullable |

### `referral_rewards`
Separate from `referrals` so a reward's own lifecycle (available → redeemed) is tracked independently.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| referral_id | uuid FK → referrals.id | on delete cascade |
| referrer_id | uuid FK → profiles.id | |
| reward_type | text | default `referral_discount` |
| reward_percent | numeric | not null |
| status | reward_status | default `pending` |
| available_from | timestamptz | |
| expires_at | timestamptz | |
| redeemed_project_id | uuid FK → projects.id | nullable |
| redeemed_at / cancelled_at | timestamptz | |
| created_at / updated_at | timestamptz | |

---

## Project pipeline

### `project_requests`
The `/start-project` form submission — a snapshot of client-provided info, separate from `profiles` so later profile edits don't rewrite history.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| request_number | text | unique |
| client_id | uuid FK → profiles.id | nullable (anonymous submissions allowed) |
| full_name | text | not null |
| email | text | not null |
| phone | text | |
| company_name | text | |
| project_type | text | |
| website_status | text | |
| page_count | integer | |
| description | text | |
| required_features | text[] | |
| has_design | boolean | |
| figma_url | text | |
| reference_urls | text[] | |
| design_style | text | |
| has_logo | boolean | |
| has_brand_colors | boolean | |
| brand_colors | text | |
| budget_min / budget_max | numeric | |
| budget_currency | text | default `BDT` |
| deadline_type | text | |
| deadline_date | date | |
| referral_code_entered | text | raw text entered by user |
| referral_code_id | uuid FK → referral_codes.id | resolved code |
| source | text | |
| status | request_status | default `new` |
| submitted_at / updated_at | timestamptz | |

### `projects`
The confirmed project, created once a request converts.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| project_number | text | unique |
| request_id | uuid FK → project_requests.id | unique |
| client_id | uuid FK → profiles.id | on delete restrict |
| title | text | not null |
| description | text | |
| status | project_status | default `pending` |
| priority | project_priority | default `normal` |
| currency | text | default `BDT` |
| estimated_budget / agreed_price | numeric | |
| start_date / due_date | date | |
| completed_at / cancelled_at | timestamptz | |
| created_at / updated_at | timestamptz | |

### `project_requirements`
Final agreed scope — may differ from the original request.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| project_id | uuid FK → projects.id | on delete cascade |
| summary | text | |
| scope | text | |
| pages | integer | |
| features | jsonb | default `[]` |
| design_notes / technical_notes / content_notes | text | |
| third_party_services | jsonb | |
| constraints | text | |
| created_at / updated_at | timestamptz | |

### `project_discounts`
Actual financial discount record — referral driven or manual/coupon.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| project_id | uuid FK → projects.id | |
| source_type | discount_source_type | referral / reward / coupon / manual / promotion |
| source_id | uuid | nullable, points at the source row |
| code / label | text | |
| percent / fixed_amount | numeric | |
| discount_amount | numeric | not null |
| currency | text | default `BDT` |
| created_at | timestamptz | |

### `project_milestones`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| project_id | uuid FK → projects.id | |
| title | text | not null |
| description | text | |
| status | milestone_status | default `pending` |
| sort_order | integer | default 0 |
| due_date | date | |
| completed_at | timestamptz | |
| created_at / updated_at | timestamptz | |

### `project_notes`
Internal-only notes, not visible to the client.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| project_id | uuid FK → projects.id | |
| author_id | uuid FK → profiles.id | |
| note | text | not null |
| is_internal | boolean | default true |
| created_at / updated_at | timestamptz | |

### `project_messages`
Client ↔ admin messaging, scoped per project (no separate conversation table needed).

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| project_id | uuid FK → projects.id | |
| sender_id | uuid FK → profiles.id | |
| message | text | not null |
| reply_to_id | uuid FK → project_messages.id | self-reference |
| is_read | boolean | default false |
| read_at | timestamptz | |
| created_at / updated_at | timestamptz | |

### `project_files`
Metadata only — actual objects live in Supabase Storage.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| project_id | uuid FK → projects.id | |
| uploaded_by | uuid FK → profiles.id | |
| bucket_name | text | not null |
| storage_path | text | not null |
| original_name | text | not null |
| mime_type | text | |
| file_size_bytes | bigint | |
| category | file_category | default `other` |
| is_public | boolean | default false |
| created_at | timestamptz | |
| deleted_at | timestamptz | soft delete |

---

## Sales — quotes, invoices, payments

### `quotes`
A project can have multiple quote versions.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| project_id | uuid FK → projects.id | |
| version | integer | default 1, unique with project_id |
| currency | text | default `BDT` |
| subtotal / discount_total / tax_total / total | numeric | default 0 |
| notes / terms | text | |
| status | quote_status | default `draft` |
| valid_until | timestamptz | |
| sent_at / accepted_at / rejected_at | timestamptz | |
| created_at / updated_at | timestamptz | |

### `quote_items`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| quote_id | uuid FK → quotes.id | |
| description | text | not null |
| quantity / unit_price / amount | numeric | |
| sort_order | integer | default 0 |
| created_at | timestamptz | |

### `invoices`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| invoice_number | text | unique |
| project_id | uuid FK → projects.id | |
| client_id | uuid FK → profiles.id | on delete restrict |
| quote_id | uuid FK → quotes.id | nullable |
| currency | text | default `BDT` |
| subtotal / discount_total / tax_total / total | numeric | default 0 |
| amount_paid / amount_due | numeric | default 0 |
| status | invoice_status | default `draft` |
| issue_date | date | default today |
| due_date | date | |
| paid_at | timestamptz | |
| created_at / updated_at | timestamptz | |

### `invoice_items`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| invoice_id | uuid FK → invoices.id | |
| description | text | not null |
| quantity / unit_price / amount | numeric | |
| created_at | timestamptz | |

### `payments`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| invoice_id | uuid FK → invoices.id | |
| project_id | uuid FK → projects.id | |
| client_id | uuid FK → profiles.id | on delete restrict |
| amount | numeric | not null |
| currency | text | default `BDT` |
| payment_type | payment_type | default `full` |
| payment_method | text | |
| provider | text | e.g. stripe/bkash/sslcommerz |
| provider_payment_id | text | |
| status | payment_status | default `pending` |
| transaction_reference | text | |
| paid_at / failed_at | timestamptz | |
| failure_reason | text | |
| created_at / updated_at | timestamptz | |

### `payment_events`
Webhook idempotency log (prevents double-processing gateway callbacks).

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| provider | text | not null |
| event_id | text | unique |
| event_type | text | not null |
| payload | jsonb | not null |
| processed | boolean | default false |
| processed_at | timestamptz | |
| error_message | text | |
| created_at | timestamptz | |

---

## Public site content

### `portfolio_projects`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| title | text | not null |
| slug | text | unique |
| short_description / description | text | |
| category | text | |
| technologies | text[] | |
| live_url / github_url / thumbnail_url | text | |
| featured / published | boolean | |
| sort_order | integer | default 0 |
| created_at / updated_at | timestamptz | |

### `portfolio_project_images`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| portfolio_project_id | uuid FK → portfolio_projects.id | |
| image_url | text | not null |
| alt_text | text | |
| sort_order | integer | default 0 |

### `services`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| name | text | not null |
| slug | text | unique |
| short_description / description | text | |
| starting_price | numeric | |
| currency | text | default `BDT` |
| estimated_days_min / estimated_days_max | integer | |
| published / featured | boolean | |
| sort_order | integer | default 0 |
| created_at / updated_at | timestamptz | |

### `service_features`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| service_id | uuid FK → services.id | |
| feature | text | not null |
| sort_order | integer | default 0 |

### `reviews`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| project_id | uuid FK → projects.id | |
| client_id | uuid FK → profiles.id | |
| rating | integer | check 1–5 |
| title | text | |
| review | text | not null |
| status | review_status | default `pending` |
| submitted_at | timestamptz | |
| published_at | timestamptz | |

### `contact_messages`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| name / email | text | not null |
| phone | text | |
| subject | text | |
| message | text | not null |
| status | contact_status | default `new` |
| created_at | timestamptz | |
| read_at / replied_at | timestamptz | |

---

## System

### `notifications`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK → profiles.id | |
| type | text | not null |
| title / message | text | not null |
| project_id | uuid FK → projects.id | nullable |
| is_read | boolean | default false |
| read_at | timestamptz | |
| created_at | timestamptz | |

### `notification_preferences`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK → profiles.id | unique |
| email_project_updates / email_messages / email_quotes / email_payments / email_referrals | boolean | default true |
| created_at / updated_at | timestamptz | |

### `audit_logs`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| actor_id | uuid FK → profiles.id | nullable |
| action | text | not null |
| entity_type | text | not null |
| entity_id | uuid | |
| old_data / new_data | jsonb | |
| ip_address | inet | |
| user_agent | text | |
| created_at | timestamptz | |

---

## Security notes

- RLS is enabled on every table above (see migration). Policies still need to be written: clients should only see rows tied to their own `profiles.id`; admins (`profiles.role = 'admin'`) see everything.
- `service_role` key must never reach the browser or be committed to the repo — it bypasses RLS entirely.
- Anonymous `/start-project` submissions (no login) should go through a restricted insert policy or a server-side endpoint, not an open public policy.
