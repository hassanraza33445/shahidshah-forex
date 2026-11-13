-- Economic Calendar V1: published, attributed scheduled dates only.
-- Forecast/previous/actual remain NULL until an authorized verified source is integrated.
create table if not exists public.economic_calendar_events (
 id uuid primary key default gen_random_uuid(),
 source_key text not null unique,
 title text not null,
 country text not null default 'US',
 currency text not null default 'USD',
 category text not null default 'Economic Data',
 impact text not null default 'MEDIUM' check(impact in ('HIGH','MEDIUM','LOW')),
 scheduled_at timestamptz not null,
 time_precision text not null default 'exact' check(time_precision in ('exact','date')),
 actual text, forecast text, previous text,
 source_name text not null,
 source_url text not null,
 status text not null default 'scheduled' check(status in ('scheduled','released','cancelled')),
 is_published boolean not null default false,
 last_verified_at timestamptz,
 updated_at timestamptz not null default now(),
 created_at timestamptz not null default now(),
 constraint event_source_link_https check(source_url like 'https://%')
);
create index if not exists economic_calendar_published_upcoming
 on public.economic_calendar_events(scheduled_at,impact) where is_published;
create index if not exists economic_calendar_currency_date
 on public.economic_calendar_events(currency,scheduled_at);
alter table public.economic_calendar_events enable row level security;
drop policy if exists "Public verified economic schedule" on public.economic_calendar_events;
create policy "Public verified economic schedule" on public.economic_calendar_events
 for select to anon,authenticated using (is_published and last_verified_at is not null);
drop policy if exists "Website admins manage economic schedule" on public.economic_calendar_events;
create policy "Website admins manage economic schedule" on public.economic_calendar_events
 for all to authenticated using (public.has_content_role(array['admin']))
 with check (public.has_content_role(array['admin']));
grant select on public.economic_calendar_events to anon, authenticated;
grant insert,update,delete on public.economic_calendar_events to authenticated;
revoke all on public.economic_calendar_events from public;

create table if not exists public.economic_calendar_sync_control(
 id smallint primary key default 1 check(id=1),
 last_started_at timestamptz,
 last_completed_at timestamptz,
 lease_expires_at timestamptz,
 last_success_at timestamptz,
 last_imported integer not null default 0,
 last_error text,
 created_at timestamptz not null default now()
);
insert into public.economic_calendar_sync_control(id) values(1) on conflict do nothing;
alter table public.economic_calendar_sync_control enable row level security;
revoke all on public.economic_calendar_sync_control from public,anon,authenticated;
grant all on public.economic_calendar_sync_control to service_role;
create or replace function public.try_begin_economic_calendar_sync()
 returns boolean language plpgsql security definer set search_path=''
as $$
begin
 update public.economic_calendar_sync_control
 set last_started_at=now(),lease_expires_at=now()+interval '4 minutes'
 where id=1 and (lease_expires_at is null or lease_expires_at<=now())
 and (last_started_at is null or last_started_at <= now()-interval '4 hours');
 return found;
end $$;
revoke all on function public.try_begin_economic_calendar_sync() from public,anon,authenticated;
grant execute on function public.try_begin_economic_calendar_sync() to service_role;

-- Source-cited first schedule. Date and exact time are from official calendars,
-- interpreted in America/New_York for correct EST/DST conversion.
insert into public.economic_calendar_events(
 source_key,title,category,impact,scheduled_at,time_precision,
 source_name,source_url,is_published,last_verified_at
)
values
('bls:import-export:2026-11-17','U.S. Import and Export Price Indexes — October 2026','Economic Data','MEDIUM',
 timestamp '2026-11-17 08:30:00' at time zone 'America/New_York','exact','U.S. Bureau of Labor Statistics','https://www.bls.gov/schedule/2026/11_sched_list.htm',true,now()),
('fed:fomc-minutes:2026-11-18','FOMC Meeting Minutes — October 27–28, 2026','Central Banks','HIGH',
 timestamp '2026-11-18 14:00:00' at time zone 'America/New_York','exact','Federal Reserve','https://www.federalreserve.gov/newsevents/calendar.htm',true,now()),
('bls:jolts:2026-12-01','Job Openings and Labor Turnover (JOLTS) — October 2026','Employment','HIGH',
 timestamp '2026-12-01 10:00:00' at time zone 'America/New_York','exact','U.S. Bureau of Labor Statistics','https://www.bls.gov/schedule/2026/12_sched_list.htm',true,now()),
('bls:employment:2026-12-04','U.S. Employment Situation (NFP) — November 2026','Employment','HIGH',
 timestamp '2026-12-04 08:30:00' at time zone 'America/New_York','exact','U.S. Bureau of Labor Statistics','https://www.bls.gov/schedule/news_release/empsit.htm',true,now()),
('fed:fomc-meeting:2026-12-08','FOMC Meeting — December 8–9, 2026','Central Banks','HIGH',
 timestamptz '2026-12-08 00:00:00+00','date','Federal Reserve','https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm',true,now()),
('bls:productivity:2026-12-08','Productivity and Costs — Q3 2026 revised','Economic Data','MEDIUM',
 timestamp '2026-12-08 08:30:00' at time zone 'America/New_York','exact','U.S. Bureau of Labor Statistics','https://www.bls.gov/schedule/2026/12_sched_list.htm',true,now()),
('bls:cpi:2026-12-10','U.S. Consumer Price Index (CPI) — November 2026','Inflation','HIGH',
 timestamp '2026-12-10 08:30:00' at time zone 'America/New_York','exact','U.S. Bureau of Labor Statistics','https://www.bls.gov/schedule/news_release/cpi.htm',true,now()),
('bls:ppi:2026-12-15','U.S. Producer Price Index (PPI) — November 2026','Inflation','HIGH',
 timestamp '2026-12-15 08:30:00' at time zone 'America/New_York','exact','U.S. Bureau of Labor Statistics','https://www.bls.gov/schedule/news_release/ppi.htm',true,now()),
('bls:import-export:2026-12-17','U.S. Import and Export Price Indexes — November 2026','Economic Data','MEDIUM',
 timestamp '2026-12-17 08:30:00' at time zone 'America/New_York','exact','U.S. Bureau of Labor Statistics','https://www.bls.gov/schedule/2026/12_sched_list.htm',true,now())
on conflict(source_key) do nothing;
