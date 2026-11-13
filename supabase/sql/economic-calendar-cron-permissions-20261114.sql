-- Security hygiene: anonymous visitors may READ verified schedules only.
revoke insert,update,delete,truncate,references,trigger
 on table public.economic_calendar_events from anon;
-- Authenticated website admins can write through RLS; no DDL-like operations.
revoke truncate,references,trigger
 on table public.economic_calendar_events from authenticated;
-- A six-hour official BLS refresh. Only invokes the narrow, lease-guarded public warm endpoint;
-- no privileged credential is stored in cron.job or pg_net request queues.
select cron.schedule(
 'smshahid-official-economic-calendar-six-hour-refresh',
 '15 */6 * * *',
 $$select net.http_get(
   url:='https://qggtdwixwafcmorepkks.supabase.co/functions/v1/economic-calendar-api?mode=warm',
   headers:='{"Accept":"application/json"}'::jsonb,
   timeout_milliseconds:=15000
 );$$
);
