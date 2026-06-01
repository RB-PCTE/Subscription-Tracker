-- Restrict renewal updates/deletes to admins only.
-- Inserts remain available to admins and members for standard renewal creation.

alter table if exists public.subscription_renewals enable row level security;

drop policy if exists "renewals update admins and members" on public.subscription_renewals;
drop policy if exists "renewals update admins only" on public.subscription_renewals;
create policy "renewals update admins only"
on public.subscription_renewals
for update
to authenticated
using (public.has_app_role(array['admin']))
with check (public.has_app_role(array['admin']));

drop policy if exists "renewals delete admins only" on public.subscription_renewals;
create policy "renewals delete admins only"
on public.subscription_renewals
for delete
to authenticated
using (public.has_app_role(array['admin']));
