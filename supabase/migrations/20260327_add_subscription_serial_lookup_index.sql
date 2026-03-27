-- Historical import uses serial_number as the stable external identifier.
-- Additive index only: no uniqueness constraint yet, so existing data is not blocked.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'subscriptions'
      and column_name = 'serial_number'
  ) then
    execute '
      create index if not exists subscriptions_serial_number_idx
      on public.subscriptions (serial_number)
      where serial_number is not null and btrim(serial_number) <> ''''
    ';
  else
    raise notice 'Skipping subscriptions_serial_number_idx: public.subscriptions.serial_number does not exist.';
  end if;
end
$$;
