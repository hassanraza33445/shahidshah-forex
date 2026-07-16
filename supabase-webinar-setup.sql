-- ============================================================
-- S M Shahid Shah Webinar System — Supabase Setup
-- Run this entire file once in: Supabase Dashboard > SQL Editor
-- This uses your EXISTING Supabase project and profiles.is_admin.
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- Core tables ----------
create table if not exists public.webinar_settings (
  id smallint primary key default 1 check (id = 1),
  event_badge text not null default 'EXCLUSIVE LIVE WEBINAR',
  event_title text not null default 'Build a Stronger Business With the Right Strategy',
  event_subtitle text not null default 'Reserve your seat for an exclusive live session with S M Shahid Shah and gain practical business insights, professional guidance and a clear action plan.',
  mentor_name text not null default 'S M Shahid Shah',
  mentor_bio text not null default 'A senior business and brokerage industry professional sharing practical experience, market knowledge and proven growth principles.',
  session_start timestamptz not null default '2026-07-18 15:00:00+00',
  review_unlock_at timestamptz not null default '2026-07-18 17:00:00+00',
  zoom_link text not null default 'https://zoom.us/',
  whatsapp_channel text not null default 'https://whatsapp.com/channel/0029VbBnk8yBadmdmS4GJM0P',
  youtube_channel text not null default 'https://www.youtube.com/@SMShahidShah',
  facebook_link text not null default 'https://www.facebook.com/SMShahidShah87',
  instagram_link text not null default 'https://www.instagram.com/s_m_shahid_shah/',
  registration_open boolean not null default true,
  registration_closed_message text not null default 'Registration is currently closed.',
  access_note text not null default 'Please join 10 minutes before the scheduled time. The meeting link is intended only for registered participants.',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

insert into public.webinar_settings (id)
values (1)
on conflict (id) do nothing;

create table if not exists public.webinar_videos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  youtube_id text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.webinar_review_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.webinar_registrations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  email_normalized text generated always as (lower(btrim(email))) stored unique,
  whatsapp text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.webinar_reviews (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null unique references public.webinar_registrations(id) on delete cascade,
  name text not null,
  email text not null,
  answers jsonb not null,
  understood_count integer not null default 0,
  confused_count integer not null default 0,
  not_clear_count integer not null default 0,
  clarity_score integer not null default 0 check (clarity_score between 0 and 100),
  submitted_at timestamptz not null default now()
);

create index if not exists webinar_videos_sort_idx on public.webinar_videos(sort_order, created_at);
create index if not exists webinar_review_items_sort_idx on public.webinar_review_items(sort_order, created_at);
create index if not exists webinar_registrations_created_idx on public.webinar_registrations(created_at desc);
create index if not exists webinar_reviews_submitted_idx on public.webinar_reviews(submitted_at desc);

-- ---------- Seed videos ----------
insert into public.webinar_videos (title, description, youtube_id, sort_order)
select * from (values
  ('Professional Insights', 'Watch practical insights and professional guidance from S M Shahid Shah.', '8oZlQjiTCcA', 1),
  ('Business & Market Knowledge', 'Learn from real industry experience and clear explanations.', 'bUaXSJkdyNs', 2),
  ('Growth-Focused Discussion', 'Explore ideas designed to improve decision-making and business direction.', 'WvFpJZzx69k', 3)
) as seed(title, description, youtube_id, sort_order)
where not exists (select 1 from public.webinar_videos);

-- ---------- Seed review content (replace/edit from admin later) ----------
insert into public.webinar_review_items (title, content, sort_order)
select * from (values
  (
    'Understanding the Core Business Direction',
    'This section should contain your complete webinar notes. You can write long explanations, multiple paragraphs, examples, action steps and important warnings. Participants will read the complete point and then confirm whether they understood it, are still confused, or need further clarification.',
    1
  ),
  (
    'Building a Practical Growth Plan',
    'Explain the step-by-step process discussed during the session. Include the correct sequence, common mistakes, realistic expectations and the specific actions participants should take after the webinar.',
    2
  ),
  (
    'Professional Communication and Follow-Up',
    'Add detailed guidance about speaking with clients, maintaining trust, following up professionally and avoiding misleading promises. This content can be as long as required and can be edited at any time from the webinar admin panel.',
    3
  )
) as seed(title, content, sort_order)
where not exists (select 1 from public.webinar_review_items);

-- ---------- Admin helper ----------
-- Assumption: your existing public.profiles table has columns: id and is_admin.
create or replace function public.is_webinar_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_admin = true
  );
$$;

revoke all on function public.is_webinar_admin() from public;
grant execute on function public.is_webinar_admin() to anon, authenticated;

create or replace function public.is_webinar_review_unlocked()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select now() >= review_unlock_at
  from public.webinar_settings
  where id = 1;
$$;

revoke all on function public.is_webinar_review_unlocked() from public;
grant execute on function public.is_webinar_review_unlocked() to anon, authenticated;

-- ---------- Public RPC: load page configuration without exposing Zoom link ----------
create or replace function public.get_webinar_public_config()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'event_badge', event_badge,
    'event_title', event_title,
    'event_subtitle', event_subtitle,
    'mentor_name', mentor_name,
    'mentor_bio', mentor_bio,
    'session_start', session_start,
    'review_unlock_at', review_unlock_at,
    'whatsapp_channel', whatsapp_channel,
    'youtube_channel', youtube_channel,
    'facebook_link', facebook_link,
    'instagram_link', instagram_link,
    'registration_open', registration_open,
    'registration_closed_message', registration_closed_message
  )
  from public.webinar_settings
  where id = 1;
$$;

-- ---------- Public RPC: reserve a seat ----------
create or replace function public.reserve_webinar_seat(
  p_name text,
  p_email text,
  p_whatsapp text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings public.webinar_settings%rowtype;
  v_existing public.webinar_registrations%rowtype;
  v_registration public.webinar_registrations%rowtype;
  v_email text := lower(btrim(coalesce(p_email, '')));
begin
  select * into v_settings from public.webinar_settings where id = 1;

  if not coalesce(v_settings.registration_open, false) then
    return jsonb_build_object(
      'success', false,
      'code', 'registration_closed',
      'message', v_settings.registration_closed_message
    );
  end if;

  if char_length(btrim(coalesce(p_name, ''))) < 2 then
    return jsonb_build_object('success', false, 'code', 'invalid_name', 'message', 'Please enter your full name.');
  end if;

  if v_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then
    return jsonb_build_object('success', false, 'code', 'invalid_email', 'message', 'Please enter a valid email address.');
  end if;

  if char_length(regexp_replace(coalesce(p_whatsapp, ''), '[^0-9+]', '', 'g')) < 7 then
    return jsonb_build_object('success', false, 'code', 'invalid_whatsapp', 'message', 'Please enter a valid WhatsApp number.');
  end if;

  select * into v_existing
  from public.webinar_registrations
  where email_normalized = v_email;

  if found then
    return jsonb_build_object(
      'success', true,
      'already_registered', true,
      'name', v_existing.name,
      'email', v_existing.email
    );
  end if;

  insert into public.webinar_registrations(name, email, whatsapp)
  values (btrim(p_name), v_email, btrim(p_whatsapp))
  returning * into v_registration;

  return jsonb_build_object(
    'success', true,
    'already_registered', false,
    'name', v_registration.name,
    'email', v_registration.email
  );
exception
  when unique_violation then
    return jsonb_build_object(
      'success', true,
      'already_registered', true,
      'name', btrim(p_name),
      'email', v_email
    );
end;
$$;

-- ---------- Public RPC: registered-user access ----------
-- No OTP by design, as requested. Entering a registered email grants access.
create or replace function public.get_webinar_access(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_registration public.webinar_registrations%rowtype;
  v_settings public.webinar_settings%rowtype;
  v_submitted boolean;
begin
  select * into v_registration
  from public.webinar_registrations
  where email_normalized = lower(btrim(coalesce(p_email, '')));

  if not found then
    return jsonb_build_object(
      'registered', false,
      'message', 'No registration was found with this email address.'
    );
  end if;

  select * into v_settings from public.webinar_settings where id = 1;
  select exists(
    select 1 from public.webinar_reviews r
    where r.registration_id = v_registration.id
  ) into v_submitted;

  return jsonb_build_object(
    'registered', true,
    'name', v_registration.name,
    'email', v_registration.email,
    'zoom_link', v_settings.zoom_link,
    'session_start', v_settings.session_start,
    'review_unlock_at', v_settings.review_unlock_at,
    'whatsapp_channel', v_settings.whatsapp_channel,
    'access_note', v_settings.access_note,
    'review_unlocked', now() >= v_settings.review_unlock_at,
    'already_submitted', v_submitted
  );
end;
$$;

-- ---------- Public RPC: submit review safely ----------
create or replace function public.submit_webinar_review(
  p_email text,
  p_answers jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_registration public.webinar_registrations%rowtype;
  v_settings public.webinar_settings%rowtype;
  v_total integer;
  v_valid integer;
  v_understood integer;
  v_confused integer;
  v_not_clear integer;
  v_score integer;
begin
  select * into v_registration
  from public.webinar_registrations
  where email_normalized = lower(btrim(coalesce(p_email, '')));

  if not found then
    return jsonb_build_object('success', false, 'code', 'not_registered', 'message', 'No registration was found with this email address.');
  end if;

  select * into v_settings from public.webinar_settings where id = 1;

  if now() < v_settings.review_unlock_at then
    return jsonb_build_object('success', false, 'code', 'locked', 'message', 'The session review is not open yet.');
  end if;

  if exists (select 1 from public.webinar_reviews where registration_id = v_registration.id) then
    return jsonb_build_object('success', false, 'code', 'already_submitted', 'message', 'A review has already been submitted with this email address.');
  end if;

  if jsonb_typeof(p_answers) <> 'array' then
    return jsonb_build_object('success', false, 'code', 'invalid_answers', 'message', 'Invalid review answers.');
  end if;

  select count(*) into v_total
  from public.webinar_review_items
  where is_active = true;

  select count(distinct (answer->>'item_id')) into v_valid
  from jsonb_array_elements(p_answers) answer
  join public.webinar_review_items item
    on item.id::text = answer->>'item_id'
   and item.is_active = true
  where answer->>'answer' in ('understood', 'confused', 'not_clear');

  if v_total = 0 or v_valid <> v_total or jsonb_array_length(p_answers) <> v_total then
    return jsonb_build_object('success', false, 'code', 'incomplete', 'message', 'Please respond to every review point.');
  end if;

  select
    count(*) filter (where answer->>'answer' = 'understood'),
    count(*) filter (where answer->>'answer' = 'confused'),
    count(*) filter (where answer->>'answer' = 'not_clear')
  into v_understood, v_confused, v_not_clear
  from jsonb_array_elements(p_answers) answer
  join public.webinar_review_items item
    on item.id::text = answer->>'item_id'
   and item.is_active = true;

  v_score := round(((v_understood::numeric + (v_confused::numeric * 0.5)) / v_total::numeric) * 100);

  insert into public.webinar_reviews(
    registration_id, name, email, answers,
    understood_count, confused_count, not_clear_count, clarity_score
  ) values (
    v_registration.id, v_registration.name, v_registration.email, p_answers,
    v_understood, v_confused, v_not_clear, v_score
  );

  return jsonb_build_object(
    'success', true,
    'name', v_registration.name,
    'understood', v_understood,
    'confused', v_confused,
    'not_clear', v_not_clear,
    'score', v_score
  );
end;
$$;

-- ---------- Automatic updated_at ----------
create or replace function public.set_webinar_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists webinar_settings_updated_at on public.webinar_settings;
create trigger webinar_settings_updated_at
before update on public.webinar_settings
for each row execute function public.set_webinar_updated_at();

drop trigger if exists webinar_videos_updated_at on public.webinar_videos;
create trigger webinar_videos_updated_at
before update on public.webinar_videos
for each row execute function public.set_webinar_updated_at();

drop trigger if exists webinar_review_items_updated_at on public.webinar_review_items;
create trigger webinar_review_items_updated_at
before update on public.webinar_review_items
for each row execute function public.set_webinar_updated_at();

-- ---------- Row Level Security ----------
alter table public.webinar_settings enable row level security;
alter table public.webinar_videos enable row level security;
alter table public.webinar_review_items enable row level security;
alter table public.webinar_registrations enable row level security;
alter table public.webinar_reviews enable row level security;

-- Remove old same-name policies safely
DROP POLICY IF EXISTS "Webinar admins manage settings" ON public.webinar_settings;
DROP POLICY IF EXISTS "Public reads active webinar videos" ON public.webinar_videos;
DROP POLICY IF EXISTS "Webinar admins manage videos" ON public.webinar_videos;
DROP POLICY IF EXISTS "Public reads review items after unlock" ON public.webinar_review_items;
DROP POLICY IF EXISTS "Webinar admins manage review items" ON public.webinar_review_items;
DROP POLICY IF EXISTS "Webinar admins read registrations" ON public.webinar_registrations;
DROP POLICY IF EXISTS "Webinar admins read reviews" ON public.webinar_reviews;

create policy "Webinar admins manage settings"
on public.webinar_settings
for all to authenticated
using (public.is_webinar_admin())
with check (public.is_webinar_admin());

create policy "Public reads active webinar videos"
on public.webinar_videos
for select to anon, authenticated
using (is_active = true or public.is_webinar_admin());

create policy "Webinar admins manage videos"
on public.webinar_videos
for all to authenticated
using (public.is_webinar_admin())
with check (public.is_webinar_admin());

create policy "Public reads review items after unlock"
on public.webinar_review_items
for select to anon, authenticated
using (
  public.is_webinar_admin()
  or (
    is_active = true
    and public.is_webinar_review_unlocked()
  )
);

create policy "Webinar admins manage review items"
on public.webinar_review_items
for all to authenticated
using (public.is_webinar_admin())
with check (public.is_webinar_admin());

create policy "Webinar admins read registrations"
on public.webinar_registrations
for select to authenticated
using (public.is_webinar_admin());

create policy "Webinar admins read reviews"
on public.webinar_reviews
for select to authenticated
using (public.is_webinar_admin());

-- ---------- Permissions ----------
revoke all on public.webinar_settings from anon, authenticated;
revoke all on public.webinar_registrations from anon, authenticated;
revoke all on public.webinar_reviews from anon, authenticated;

-- Admins still access tables through RLS after these grants.
grant select, insert, update, delete on public.webinar_settings to authenticated;
grant select, insert, update, delete on public.webinar_videos to authenticated;
grant select, insert, update, delete on public.webinar_review_items to authenticated;
grant select on public.webinar_registrations to authenticated;
grant select on public.webinar_reviews to authenticated;
grant select on public.webinar_videos to anon;
grant select on public.webinar_review_items to anon;

revoke all on function public.get_webinar_public_config() from public;
revoke all on function public.reserve_webinar_seat(text, text, text) from public;
revoke all on function public.get_webinar_access(text) from public;
revoke all on function public.submit_webinar_review(text, jsonb) from public;

grant execute on function public.get_webinar_public_config() to anon, authenticated;
grant execute on function public.reserve_webinar_seat(text, text, text) to anon, authenticated;
grant execute on function public.get_webinar_access(text) to anon, authenticated;
grant execute on function public.submit_webinar_review(text, jsonb) to anon, authenticated;

-- ---------- Make your existing user an admin ----------
-- Replace the email below, then run this line separately if needed:
-- update public.profiles set is_admin = true where email = 'YOUR-ADMIN-EMAIL@example.com';

-- ============================================================
-- Setup complete.
-- IMPORTANT: Never place the Supabase service_role key in HTML.
-- The public/publishable anon key is safe for frontend use with RLS.
-- ============================================================


-- ============================================================
-- S M Shahid Shah Webinar — Visitor Analytics Upgrade
-- Run once in Supabase SQL Editor after the main setup SQL.
-- ============================================================

create table if not exists public.webinar_visits (
  id bigint generated by default as identity primary key,
  visitor_id uuid not null,
  session_id uuid not null,
  path text not null default '/',
  referrer text not null default 'Direct',
  device_type text not null default 'desktop' check (device_type in ('mobile','tablet','desktop')),
  browser_language text,
  screen_size text,
  visited_at timestamptz not null default now()
);

create index if not exists webinar_visits_visited_at_idx on public.webinar_visits (visited_at desc);
create index if not exists webinar_visits_visitor_id_idx on public.webinar_visits (visitor_id);
create index if not exists webinar_visits_device_type_idx on public.webinar_visits (device_type);

alter table public.webinar_visits enable row level security;

drop policy if exists "Webinar admins read visits" on public.webinar_visits;
create policy "Webinar admins read visits"
on public.webinar_visits
for select to authenticated
using (public.is_webinar_admin());

create or replace function public.track_webinar_visit(
  p_visitor_id uuid,
  p_session_id uuid,
  p_path text default '/',
  p_referrer text default 'Direct',
  p_device_type text default 'desktop',
  p_browser_language text default null,
  p_screen_size text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.webinar_visits (
    visitor_id, session_id, path, referrer, device_type,
    browser_language, screen_size
  ) values (
    p_visitor_id,
    p_session_id,
    left(coalesce(nullif(trim(p_path), ''), '/'), 300),
    left(coalesce(nullif(trim(p_referrer), ''), 'Direct'), 300),
    case when p_device_type in ('mobile','tablet','desktop') then p_device_type else 'desktop' end,
    left(nullif(trim(p_browser_language), ''), 30),
    left(nullif(trim(p_screen_size), ''), 30)
  );
end;
$$;

create or replace function public.get_webinar_visit_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today_start timestamptz := date_trunc('day', now() at time zone 'Asia/Karachi') at time zone 'Asia/Karachi';
  v_result jsonb;
begin
  if not public.is_webinar_admin() then
    raise exception 'Not authorized';
  end if;

  select jsonb_build_object(
    'total_visits', count(*),
    'unique_visitors', count(distinct visitor_id),
    'today_visits', count(*) filter (where visited_at >= v_today_start),
    'last_7_days', count(*) filter (where visited_at >= now() - interval '7 days'),
    'last_30_days', count(*) filter (where visited_at >= now() - interval '30 days'),
    'mobile_visits', count(*) filter (where device_type = 'mobile'),
    'tablet_visits', count(*) filter (where device_type = 'tablet'),
    'desktop_visits', count(*) filter (where device_type = 'desktop')
  ) into v_result
  from public.webinar_visits;

  v_result := v_result || jsonb_build_object(
    'top_referrers', coalesce((
      select jsonb_agg(jsonb_build_object('source', source, 'visits', visits) order by visits desc)
      from (
        select coalesce(nullif(referrer, ''), 'Direct') as source, count(*) as visits
        from public.webinar_visits
        group by 1
        order by visits desc
        limit 5
      ) ranked
    ), '[]'::jsonb)
  );

  return v_result;
end;
$$;

revoke all on public.webinar_visits from anon, authenticated;
grant select on public.webinar_visits to authenticated;

revoke all on function public.track_webinar_visit(uuid, uuid, text, text, text, text, text) from public;
revoke all on function public.get_webinar_visit_stats() from public;
grant execute on function public.track_webinar_visit(uuid, uuid, text, text, text, text, text) to anon, authenticated;
grant execute on function public.get_webinar_visit_stats() to authenticated;

-- Visitor IDs are browser-generated anonymous identifiers. No email, phone,
-- precise location or IP address is stored by this setup.
