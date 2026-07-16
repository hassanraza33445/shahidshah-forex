-- S M Shahid Shah Webinar — Visitor Analytics Realtime Upgrade
-- Run once only if you already ran the previous visitor analytics SQL.

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'webinar_visits'
  ) then
    execute 'alter publication supabase_realtime add table public.webinar_visits';
  end if;
end $$;
