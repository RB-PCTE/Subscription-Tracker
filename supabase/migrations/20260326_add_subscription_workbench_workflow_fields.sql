-- Add manual Renewal Workbench workflow fields to subscriptions.
-- These fields intentionally do not affect calculated status or renewal outcomes.

alter table if exists public.subscriptions
  add column if not exists quote_progress text,
  add column if not exists invoice_progress text,
  add column if not exists final_warning_progress text,
  add column if not exists renewal_workflow_note text;

update public.subscriptions
set
  quote_progress = coalesce(nullif(lower(btrim(quote_progress)), ''), 'not started'),
  invoice_progress = coalesce(nullif(lower(btrim(invoice_progress)), ''), 'not started'),
  final_warning_progress = coalesce(nullif(lower(btrim(final_warning_progress)), ''), 'not started')
where true;

alter table public.subscriptions
  alter column quote_progress set default 'not started',
  alter column quote_progress set not null,
  alter column invoice_progress set default 'not started',
  alter column invoice_progress set not null,
  alter column final_warning_progress set default 'not started',
  alter column final_warning_progress set not null;

alter table public.subscriptions
  drop constraint if exists subscriptions_quote_progress_ck,
  drop constraint if exists subscriptions_invoice_progress_ck,
  drop constraint if exists subscriptions_final_warning_progress_ck;

alter table public.subscriptions
  add constraint subscriptions_quote_progress_ck
  check (quote_progress in ('not started', 'drafting', 'sent', 'follow up needed', 'accepted', 'declined')),
  add constraint subscriptions_invoice_progress_ck
  check (invoice_progress in ('not started', 'prepared', 'sent', 'awaiting payment', 'paid')),
  add constraint subscriptions_final_warning_progress_ck
  check (final_warning_progress in ('not started', 'sent', 'follow up needed', 'escalated', 'closed'));

-- No RLS policy changes are required: existing subscriptions update policies for
-- admins/members already apply to these additive columns.
