-- Align subscription_renewals with renewal modal payloads.
-- This migration is backward-compatible with older deployments that used
-- renewal_start_date / renewal_end_date / billing_cycle naming.

alter table if exists public.subscription_renewals
  add column if not exists start_date date,
  add column if not exists end_date date,
  add column if not exists billing_frequency text,
  add column if not exists renewal_outcome text,
  add column if not exists status text,
  add column if not exists notes text;

-- Backfill canonical columns from legacy names where available.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'subscription_renewals'
      and column_name = 'renewal_start_date'
  ) then
    execute '
      update public.subscription_renewals
      set start_date = coalesce(start_date, renewal_start_date)
      where start_date is null and renewal_start_date is not null
    ';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'subscription_renewals'
      and column_name = 'renewal_end_date'
  ) then
    execute '
      update public.subscription_renewals
      set end_date = coalesce(end_date, renewal_end_date)
      where end_date is null and renewal_end_date is not null
    ';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'subscription_renewals'
      and column_name = 'billing_cycle'
  ) then
    execute '
      update public.subscription_renewals
      set billing_frequency = coalesce(billing_frequency, billing_cycle)
      where billing_frequency is null and billing_cycle is not null
    ';
  end if;
end
$$;

-- Keep start date required; churned/migrated rows can omit end date + billing frequency.
alter table public.subscription_renewals
  alter column start_date set not null,
  alter column end_date drop not null,
  alter column billing_frequency drop not null,
  alter column renewal_outcome set default 'renewed',
  alter column renewal_outcome set not null;

-- Migrate historical pending/blank values into the allowed outcome set.
update public.subscription_renewals
set renewal_outcome = 'renewed'
where renewal_outcome is null
   or btrim(renewal_outcome) = ''
   or lower(renewal_outcome) = 'pending';

-- Normalize case for existing values.
update public.subscription_renewals
set renewal_outcome = lower(renewal_outcome)
where renewal_outcome is not null;

-- Replace constraints with rules for the new workflow.
alter table public.subscription_renewals
  drop constraint if exists subscription_renewals_date_range_ck;

alter table public.subscription_renewals
  add constraint subscription_renewals_date_range_ck
  check (
    end_date is null
    or start_date is null
    or end_date >= start_date
  );

alter table public.subscription_renewals
  drop constraint if exists subscription_renewals_outcome_ck;

alter table public.subscription_renewals
  add constraint subscription_renewals_outcome_ck
  check (renewal_outcome in ('renewed', 'churned', 'migrated'));

alter table public.subscription_renewals
  drop constraint if exists subscription_renewals_renewed_requires_term_ck;

alter table public.subscription_renewals
  add constraint subscription_renewals_renewed_requires_term_ck
  check (
    (renewal_outcome = 'renewed' and end_date is not null and nullif(btrim(billing_frequency), '') is not null)
    or (renewal_outcome in ('churned', 'migrated') and end_date is null)
  );

-- Ensure canonical sort/query index exists regardless of earlier schema state.
create index if not exists subscription_renewals_subscription_start_date_idx
  on public.subscription_renewals (subscription_id, start_date desc);
