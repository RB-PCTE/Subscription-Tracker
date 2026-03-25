-- Remove legacy vendor fields from public.subscriptions.
-- This migration fully removes vendor from the data model.

begin;

-- Safety: immediately unblock inserts/updates if vendor_name still exists.
alter table if exists public.subscriptions
  alter column if exists vendor_name drop not null;

-- Remove any vendor-related constraints/indexes/default-bearing columns by dropping
-- the vendor columns directly. PostgreSQL will remove column-attached defaults and
-- check constraints that reference only these columns automatically.
alter table if exists public.subscriptions
  drop column if exists vendor_name,
  drop column if exists vendor_id;

commit;
