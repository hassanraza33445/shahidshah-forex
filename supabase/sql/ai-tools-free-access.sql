-- ============================================================
-- S M SHAHID SHAH — AI TOOLS FREE ACCESS GATE
-- Run once in Supabase SQL Editor after the existing webinar tables.
-- Safe additive migration: no existing webinar registration is changed.
-- ============================================================

create table if not exists public.ai_tool_access_leads (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 160),
  email text not null,
  whatsapp text not null,
  access_source text not null default 'ai_form' check (access_source in ('ai_form')),
  created_at timestamptz not null default now(),
  last_verified_at timestamptz not null default now()
);

create unique index if not exists ai_tool_access_leads_email_unique
  on public.ai_tool_access_leads (lower(trim(email)));

create index if not exists ai_tool_access_leads_whatsapp_normalized_idx
  on public.ai_tool_access_leads ((regexp_replace(coalesce(whatsapp,''), '\D', '', 'g')));

alter table public.ai_tool_access_leads enable row level security;

drop policy if exists "Admins manage AI tool access leads" on public.ai_tool_access_leads;
create policy "Admins manage AI tool access leads"
  on public.ai_tool_access_leads
  for all
  to authenticated
  using (public.is_webinar_admin())
  with check (public.is_webinar_admin());

grant select, insert, update, delete on public.ai_tool_access_leads to authenticated;

create or replace function public.check_ai_tool_access(
  p_email text default null,
  p_whatsapp text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email,'')));
  v_phone text := regexp_replace(coalesce(p_whatsapp,''), '\D', '', 'g');
  v_record record;
begin
  if v_email = '' and v_phone = '' then
    return jsonb_build_object('success',true,'has_access',false);
  end if;

  select r.name, lower(trim(r.email)) as email, r.whatsapp
    into v_record
  from public.webinar_registrations r
  where (v_email <> '' and lower(trim(r.email)) = v_email)
     or (char_length(v_phone) >= 7 and regexp_replace(coalesce(r.whatsapp,''), '\D', '', 'g') = v_phone)
  order by r.created_at desc
  limit 1;

  if found then
    return jsonb_build_object(
      'success',true,
      'has_access',true,
      'source','webinar_registration'
    );
  end if;

  select a.name, lower(trim(a.email)) as email, a.whatsapp
    into v_record
  from public.ai_tool_access_leads a
  where (v_email <> '' and lower(trim(a.email)) = v_email)
     or (char_length(v_phone) >= 7 and regexp_replace(coalesce(a.whatsapp,''), '\D', '', 'g') = v_phone)
  order by a.created_at desc
  limit 1;

  if found then
    update public.ai_tool_access_leads
       set last_verified_at = now()
     where lower(trim(email)) = v_record.email;

    return jsonb_build_object(
      'success',true,
      'has_access',true,
      'source','ai_form'
    );
  end if;

  return jsonb_build_object('success',true,'has_access',false);
end;
$$;

create or replace function public.request_ai_tool_access(
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
  v_name text := trim(coalesce(p_name,''));
  v_email text := lower(trim(coalesce(p_email,'')));
  v_whatsapp text := trim(coalesce(p_whatsapp,''));
  v_phone text := regexp_replace(coalesce(p_whatsapp,''), '\D', '', 'g');
  v_existing jsonb;
  v_row public.ai_tool_access_leads%rowtype;
begin
  if char_length(v_name) < 2 or char_length(v_name) > 160 then
    return jsonb_build_object('success',false,'message','Please enter your correct full name.');
  end if;

  if v_email = '' or v_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then
    return jsonb_build_object('success',false,'message','Please enter a valid email address.');
  end if;

  if char_length(v_phone) < 7 or char_length(v_phone) > 18 then
    return jsonb_build_object('success',false,'message','Please enter a valid WhatsApp number with country code.');
  end if;

  v_existing := public.check_ai_tool_access(v_email,v_whatsapp);
  if coalesce((v_existing->>'has_access')::boolean,false) then
    return v_existing || jsonb_build_object('success',true,'already_registered',true);
  end if;

  insert into public.ai_tool_access_leads(name,email,whatsapp,access_source)
  values (v_name,v_email,v_whatsapp,'ai_form')
  on conflict ((lower(trim(email)))) do update
    set name = excluded.name,
        whatsapp = excluded.whatsapp,
        last_verified_at = now()
  returning * into v_row;

  return jsonb_build_object(
    'success',true,
    'has_access',true,
    'already_registered',false,
    'source','ai_form',
    'name',v_row.name,
    'email',lower(trim(v_row.email)),
    'whatsapp',v_row.whatsapp,
    'message','Free AI tools access unlocked.'
  );
end;
$$;

revoke all on function public.check_ai_tool_access(text,text) from public;
revoke all on function public.request_ai_tool_access(text,text,text) from public;

grant execute on function public.check_ai_tool_access(text,text) to anon, authenticated;
grant execute on function public.request_ai_tool_access(text,text,text) to anon, authenticated;
