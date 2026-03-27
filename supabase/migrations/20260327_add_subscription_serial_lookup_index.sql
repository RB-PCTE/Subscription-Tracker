-- Historical import uses serial_number as the stable external identifier.
-- Additive index only: no uniqueness constraint yet, so existing data is not blocked.
create index if not exists subscriptions_serial_number_idx
  on public.subscriptions (serial_number)
  where serial_number is not null and btrim(serial_number) <> '';
