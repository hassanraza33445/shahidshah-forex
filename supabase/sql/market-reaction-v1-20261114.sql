-- Market Reaction V1. No demonstration/fabricated market data.
-- Provider-supplied historical M1 candles are retained for source audit.
-- Public results require both admin review and explicit redistribution-rights confirmation.
create table if not exists public.market_reaction_candles(
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references public.economic_calendar_events(id) on delete cascade,
 symbol text not null check(symbol in ('XAUUSD','EURUSD','GBPUSD','USDJPY','BTCUSD')),
 provider text not null check(provider='twelve_data'),
 bar_open timestamptz not null,
 open_price numeric(24,10) not null check(open_price>0),
 high_price numeric(24,10) not null check(high_price>0),
 low_price numeric(24,10) not null check(low_price>0),
 close_price numeric(24,10) not null check(close_price>0),
 provider_source_url text not null check(provider_source_url like 'https://%'),
 captured_at timestamptz not null default now(),
 constraint reaction_candle_ohlc check(
   high_price >= greatest(open_price,close_price,low_price)
   and low_price <= least(open_price,close_price,high_price)
 ),
 unique(event_id,symbol,provider,bar_open)
);
create index if not exists reaction_candle_event_time
 on public.market_reaction_candles(event_id,symbol,bar_open);
alter table public.market_reaction_candles enable row level security;
revoke all on public.market_reaction_candles from public,anon,authenticated;
grant all on public.market_reaction_candles to service_role;

create table if not exists public.market_event_reactions(
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references public.economic_calendar_events(id) on delete cascade,
 symbol text not null check(symbol in ('XAUUSD','EURUSD','GBPUSD','USDJPY','BTCUSD')),
 provider text not null check(provider='twelve_data'),
 horizon_minutes smallint not null check(horizon_minutes in (5,15,30,60)),
 baseline_bar_open timestamptz not null,
 target_bar_open timestamptz not null,
 baseline_close numeric(24,10) not null check(baseline_close>0),
 target_close numeric(24,10) not null check(target_close>0),
 move_absolute numeric(24,10) not null,
 move_percent numeric(20,8) not null,
 fx_pips numeric(20,4),
 provider_source_url text not null check(provider_source_url like 'https://%'),
 observed_at timestamptz not null default now(),
 reviewed_at timestamptz,
 license_confirmed_at timestamptz,
 is_published boolean not null default false,
 constraint market_reaction_publish_requires_review check
   (not is_published or (reviewed_at is not null and license_confirmed_at is not null)),
 unique(event_id,symbol,provider,horizon_minutes)
);
create index if not exists market_reaction_public_event
 on public.market_event_reactions(event_id,symbol,horizon_minutes) where is_published;
alter table public.market_event_reactions enable row level security;
drop policy if exists "Verified licensed market reactions public" on public.market_event_reactions;
create policy "Verified licensed market reactions public" on public.market_event_reactions
 for select to anon,authenticated
 using (is_published and reviewed_at is not null and license_confirmed_at is not null);
revoke all on public.market_event_reactions from public,anon,authenticated;
grant select on public.market_event_reactions to anon,authenticated;
grant all on public.market_event_reactions to service_role;

create table if not exists public.market_reaction_sync_logs(
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references public.economic_calendar_events(id) on delete cascade,
 symbol text not null check(symbol in ('XAUUSD','EURUSD','GBPUSD','USDJPY','BTCUSD')),
 provider text not null default 'twelve_data' check(provider='twelve_data'),
 result text not null check(result in ('success','partial','unavailable','provider_error','rejected')),
 candle_count integer not null default 0 check(candle_count>=0),
 horizon_count integer not null default 0 check(horizon_count between 0 and 4),
 detail text,
 requested_at timestamptz not null default now()
);
create index if not exists market_reaction_sync_latest
 on public.market_reaction_sync_logs(requested_at desc);
alter table public.market_reaction_sync_logs enable row level security;
revoke all on public.market_reaction_sync_logs from public,anon,authenticated;
grant all on public.market_reaction_sync_logs to service_role;
-- Intentionally no insert/grant on price series to browser roles.
