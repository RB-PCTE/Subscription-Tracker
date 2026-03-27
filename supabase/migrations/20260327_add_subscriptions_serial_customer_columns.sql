-- Normalize critical subscription metadata into first-class columns.
-- Keep notes unchanged while extracting serial/customer metadata from embedded notes JSON.

begin;

alter table if exists public.subscriptions
  add column if not exists serial_number text,
  add column if not exists customer text;

with extracted as (
  select
    id,
    case
      when notes is not null and notes ~ '__SUBSCRIPTION_METADATA__:\s*\{.*\}\s*$'
        then (substring(notes from '__SUBSCRIPTION_METADATA__:\s*(\{.*\})\s*$'))::jsonb
      else null
    end as metadata
  from public.subscriptions
)
update public.subscriptions as s
set
  serial_number = coalesce(nullif(btrim(s.serial_number), ''), nullif(btrim(extracted.metadata ->> 'serialNumber'), '')),
  customer = coalesce(nullif(btrim(s.customer), ''), nullif(btrim(extracted.metadata ->> 'customerCompanyName'), ''))
from extracted
where s.id = extracted.id;

-- Normalize any blank serial values to null before enforcing constraints.
update public.subscriptions
set serial_number = nullif(btrim(serial_number), '')
where true;

do $$
begin
  if exists (
    select 1
    from public.subscriptions
    where serial_number is null
  ) then
    raise exception 'Cannot enforce serial_number NOT NULL: one or more subscriptions are missing serial_number values';
  end if;

  if exists (
    select serial_number
    from public.subscriptions
    group by serial_number
    having count(*) > 1
  ) then
    raise exception 'Cannot enforce serial_number UNIQUE: duplicate serial_number values exist in subscriptions';
  end if;
end $$;

alter table public.subscriptions
  alter column serial_number set not null;

alter table public.subscriptions
  add constraint subscriptions_serial_number_key unique (serial_number);

commit;
