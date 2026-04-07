-- Weekly executive summary email automation.
-- Adds SQL helpers to configure a pg_cron job that triggers the edge function.

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.configure_weekly_summary_email_schedule(
  edge_base_url text,
  edge_anon_key text,
  cron_secret text,
  cron_expression text default '0 13 * * 1'
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_base_url text;
  schedule_sql text;
  existing_job_id bigint;
  scheduled_job_id bigint;
begin
  if edge_base_url is null or btrim(edge_base_url) = '' then
    raise exception 'edge_base_url is required';
  end if;

  if edge_anon_key is null or btrim(edge_anon_key) = '' then
    raise exception 'edge_anon_key is required';
  end if;

  if cron_secret is null or btrim(cron_secret) = '' then
    raise exception 'cron_secret is required';
  end if;

  normalized_base_url := regexp_replace(btrim(edge_base_url), '/+$', '');

  select jobid
  into existing_job_id
  from cron.job
  where jobname = 'weekly-subscription-summary-email'
  limit 1;

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  schedule_sql := format(
    $cmd$
    select
      net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer %s',
          'x-cron-secret', %L
        ),
        body := jsonb_build_object('trigger', 'pg_cron')
      ) as request_id;
    $cmd$,
    normalized_base_url || '/functions/v1/weekly-summary-email',
    edge_anon_key,
    cron_secret
  );

  scheduled_job_id := cron.schedule(
    'weekly-subscription-summary-email',
    cron_expression,
    schedule_sql
  );

  return scheduled_job_id;
end;
$$;

comment on function public.configure_weekly_summary_email_schedule(text, text, text, text)
is 'Creates or replaces the weekly cron job that calls the weekly-summary-email edge function.';

create or replace function public.remove_weekly_summary_email_schedule()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_job_id bigint;
begin
  select jobid
  into existing_job_id
  from cron.job
  where jobname = 'weekly-subscription-summary-email'
  limit 1;

  if existing_job_id is null then
    return false;
  end if;

  perform cron.unschedule(existing_job_id);
  return true;
end;
$$;

comment on function public.remove_weekly_summary_email_schedule()
is 'Deletes the weekly-subscription-summary-email cron job if present.';
