-- Subscription renewals table + RLS policies.
-- Safe to run in Supabase SQL editor.

create extension if not exists pgcrypto;

create table if not exists public.subscription_renewals (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  billing_frequency text,
  renewal_outcome text not null default 'pending',
  status text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscription_renewals_date_range_ck check (end_date >= start_date),
  constraint subscription_renewals_outcome_ck check (renewal_outcome in ('pending', 'renewed', 'churned', 'migrated'))
);

create index if not exists subscription_renewals_subscription_id_idx
  on public.subscription_renewals (subscription_id);

create index if not exists subscription_renewals_subscription_start_date_idx
  on public.subscription_renewals (subscription_id, start_date desc);

create index if not exists subscription_renewals_start_date_idx
  on public.subscription_renewals (start_date);

create or replace function public.set_updated_at_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_subscription_renewals_updated_at on public.subscription_renewals;
create trigger trg_subscription_renewals_updated_at
before update on public.subscription_renewals
for each row
execute function public.set_updated_at_timestamp();

alter table public.subscription_renewals enable row level security;

create or replace function public.has_app_role(allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.app_users au
    where au.user_id = auth.uid()
      and au.role = any(allowed_roles)
  );
$$;

grant execute on function public.has_app_role(text[]) to authenticated;

drop policy if exists "renewals select app users" on public.subscription_renewals;
create policy "renewals select app users"
on public.subscription_renewals
for select
to authenticated
using (public.has_app_role(array['admin', 'member', 'viewer']));

drop policy if exists "renewals insert admins and members" on public.subscription_renewals;
create policy "renewals insert admins and members"
on public.subscription_renewals
for insert
to authenticated
with check (
  public.has_app_role(array['admin', 'member'])
);

drop policy if exists "renewals update admins and members" on public.subscription_renewals;
create policy "renewals update admins and members"
on public.subscription_renewals
for update
to authenticated
using (public.has_app_role(array['admin', 'member']))
with check (public.has_app_role(array['admin', 'member']));

drop policy if exists "renewals delete admins only" on public.subscription_renewals;
create policy "renewals delete admins only"
on public.subscription_renewals
for delete
to authenticated
using (public.has_app_role(array['admin']));
