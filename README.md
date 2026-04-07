# Subscription Tracker

A starter scaffold for building a customer subscription tracking app.

## Project layout

- `index.html`: static frontend shell with authentication UI.
- `styles.css`: styles for the static frontend.
- `app.js`: auth flow + subscriptions CRUD wiring for Supabase.
- `supabaseClient.js`: Supabase browser client initialization.
- `src/subscription_tracker/models.py`: domain models for billing cycles and subscriptions.
- `src/subscription_tracker/tracker.py`: in-memory tracker with add/remove/summary behavior.
- `tests/test_tracker.py`: basic unit tests validating scaffold behavior.

## Supabase auth notes

- This frontend uses the Supabase **anon key** in browser code. That key is designed to be public in client apps.
- Data security is enforced by Supabase Row Level Security (RLS) policies.
- For magic-link auth redirects, run the app from `http://localhost` (or deploy to GitHub Pages). Avoid using `file://` URLs for best results.

## Database setup

Create a table named `public.subscriptions` with these columns:

- `id` (uuid, primary key)
- `product_name` (text, optional)
- `customer_company_name` (text, optional)
- `contact_name` (text, optional)
- `contact_email` (text, optional)
- `contact_phone` (text, optional)
- `equipment_name` (text, optional)
- `serial_number` (text, optional)
- `subscription_metadata` (jsonb, optional)
- `plan` (text, optional)
- `billing_cycle` (text, default `monthly`)
- `start_date` (date, optional)
- `status` (text, default `active`)
- `notes` (text, optional)
- `created_by` (uuid, optional)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)
- `quote_progress` (text, default `not started`)
- `invoice_progress` (text, default `not started`)
- `final_warning_progress` (text, default `not started`)
- `renewal_workflow_note` (text, optional short Ops note)

Create a second table named `public.subscription_renewals` to preserve renewal history separately from the base subscription:

- `id` (uuid, primary key)
- `subscription_id` (uuid, references `public.subscriptions.id`)
- `start_date` (date, required)
- `end_date` (date, optional for churned/migrated; required for renewed)
- `billing_frequency` (text, optional)
- `renewal_outcome` (text, required: `renewed` | `churned` | `migrated`)
- `status` (text, optional)
- `notes` (text, optional)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

The complete migration (table, FK, indexes, `updated_at` trigger, RLS, and policies) is included at:

- `supabase/migrations/20260324_create_subscription_renewals.sql`
- `supabase/migrations/20260325_align_subscription_renewals_schema.sql` (schema alignment + compatibility backfill)
- `supabase/migrations/20260326_add_subscription_workbench_workflow_fields.sql` (manual workflow tracking fields for the Renewal Workbench)

The UI treats `public.subscriptions` as parent/master records and `public.subscription_renewals` as child term events. Existing deployments without the renewals table still load subscription data; renewals are simply unavailable until the table is created.

Legacy columns such as `cost_amount`, `cost_currency`, or `renewal_date` can remain in older databases for backwards compatibility, but the current UI no longer writes or displays cost and uses **start date** wording.

Enable RLS and add policies so authenticated users can read and write rows needed by this app (select, insert, update, delete).

### Invite-based user access (admin flow)

Create an invites table so admins can grant access by email:

```sql
create extension if not exists pgcrypto;

create table if not exists public.app_invites (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  role text not null,
  created_at timestamptz not null default now()
);

alter table public.app_invites enable row level security;
```

Add simple RLS policies for `public.app_invites`:

```sql
-- Any authenticated user can read invite rows for their own email.
create policy "invite self read"
on public.app_invites
for select
to authenticated
using (lower(email) = lower(auth.jwt()->>'email'));

-- Admins can read all invites.
create policy "admin read all invites"
on public.app_invites
for select
to authenticated
using (
  exists (
    select 1
    from public.app_users au
    where au.user_id = auth.uid() and au.role = 'admin'
  )
);

-- Admins can insert/update/delete invites.
create policy "admin insert invites"
on public.app_invites
for insert
to authenticated
with check (
  exists (
    select 1
    from public.app_users au
    where au.user_id = auth.uid() and au.role = 'admin'
  )
);

create policy "admin update invites"
on public.app_invites
for update
to authenticated
using (
  exists (
    select 1
    from public.app_users au
    where au.user_id = auth.uid() and au.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.app_users au
    where au.user_id = auth.uid() and au.role = 'admin'
  )
);

create policy "admin delete invites"
on public.app_invites
for delete
to authenticated
using (
  exists (
    select 1
    from public.app_users au
    where au.user_id = auth.uid() and au.role = 'admin'
  )
);
```

When a user signs in, the app checks:

1. If `public.app_users` already contains their `user_id`, use that role.
2. If not, look up `public.app_invites` by signed-in email.
3. If invite exists, upsert a new `public.app_users` row (`user_id`, `role`) and delete the invite.

## Getting started

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e .
python -m unittest discover -s tests
```

## Weekly summary email automation

The project includes a backend-only weekly summary email pipeline using a Supabase Edge Function + pg_cron scheduler:

- Edge function: `supabase/functions/weekly-summary-email/index.ts`
- Scheduler migration: `supabase/migrations/20260407_add_weekly_summary_email_automation.sql`

### What it sends

Each weekly email includes:

- Summary metrics (total, active, due in 30/60 days, needs attention, final warning, churned/migrated in last 7 days)
- Problem subscriptions (attn required, final warning, overdue)
- Upcoming work (quote/invoice/final warning in the next 60 days)
- Recent updates from workflow-history + renewal events (last 7 days)

### Required secrets

Set these Supabase Edge Function secrets:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL` (example: `Subscription Tracker <ops@your-domain.com>`)
- `WEEKLY_SUMMARY_RECIPIENT` (defaults to `you@example.com` if omitted)
- `WEEKLY_SUMMARY_CRON_SECRET` (shared secret for scheduler -> function authentication)

### Deploy + schedule

1. Deploy function:

```bash
supabase functions deploy weekly-summary-email
```

2. Configure the weekly schedule (recommended Monday at 13:00 UTC):

```sql
select public.configure_weekly_summary_email_schedule(
  edge_base_url := 'https://<PROJECT-REF>.supabase.co',
  edge_anon_key := '<SUPABASE_ANON_KEY>',
  cron_secret := '<MATCHES_WEEKLY_SUMMARY_CRON_SECRET>',
  cron_expression := '0 13 * * 1'
);
```

3. Optional dry run:

```bash
curl -sS "https://<PROJECT-REF>.supabase.co/functions/v1/weekly-summary-email?dry_run=1" \
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \
  -H "x-cron-secret: <MATCHES_WEEKLY_SUMMARY_CRON_SECRET>"
```

To remove the job later:

```sql
select public.remove_weekly_summary_email_schedule();
```
