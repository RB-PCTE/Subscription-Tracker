-- Weekly summary email observability and manual verification support.

create table if not exists public.weekly_summary_email_runs (
  id uuid primary key default gen_random_uuid(),
  trigger_source text not null default 'manual',
  status text not null,
  recipient text not null,
  summary_metrics jsonb,
  provider_message_id text,
  error_message text,
  created_at timestamptz not null default now(),
  constraint weekly_summary_email_runs_status_ck
    check (status in ('dry_run', 'sent', 'failed'))
);

create index if not exists weekly_summary_email_runs_created_at_idx
  on public.weekly_summary_email_runs (created_at desc);

alter table public.weekly_summary_email_runs enable row level security;

drop policy if exists "weekly summary run logs select app users" on public.weekly_summary_email_runs;
create policy "weekly summary run logs select app users"
on public.weekly_summary_email_runs
for select
to authenticated
using (public.has_app_role(array['admin', 'member', 'viewer']));
