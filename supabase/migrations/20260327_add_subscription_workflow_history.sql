-- Add additive Renewal Workbench workflow history table.
-- Tracks manual progress updates by stage and scopes them to the current renewal phase.

create extension if not exists pgcrypto;

create table if not exists public.subscription_workflow_history (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  renewal_phase_key text not null,
  renewal_term_id uuid references public.subscription_renewals(id) on delete set null,
  renewal_phase_start_date date,
  renewal_phase_end_date date,
  stage text not null,
  progress_value text not null,
  note text,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscription_workflow_history_stage_ck
    check (stage in ('quote', 'invoice', 'final warning')),
  constraint subscription_workflow_history_progress_by_stage_ck
    check (
      (stage = 'quote' and progress_value in ('sent', 'contact issues'))
      or (stage = 'invoice' and progress_value in ('sent', 'po received', 'eft unpaid', 'eft paid'))
      or (stage = 'final warning' and progress_value in ('churning', 'po promised', 'eft unpaid'))
    )
);

create index if not exists subscription_workflow_history_subscription_phase_idx
  on public.subscription_workflow_history (subscription_id, renewal_phase_key, created_at);

create index if not exists subscription_workflow_history_term_idx
  on public.subscription_workflow_history (renewal_term_id)
  where renewal_term_id is not null;

drop trigger if exists trg_subscription_workflow_history_updated_at on public.subscription_workflow_history;
create trigger trg_subscription_workflow_history_updated_at
before update on public.subscription_workflow_history
for each row
execute function public.set_updated_at_timestamp();

alter table public.subscription_workflow_history enable row level security;

drop policy if exists "workflow history select app users" on public.subscription_workflow_history;
create policy "workflow history select app users"
on public.subscription_workflow_history
for select
to authenticated
using (public.has_app_role(array['admin', 'member', 'viewer']));

drop policy if exists "workflow history insert admins and members" on public.subscription_workflow_history;
create policy "workflow history insert admins and members"
on public.subscription_workflow_history
for insert
to authenticated
with check (public.has_app_role(array['admin', 'member']));
