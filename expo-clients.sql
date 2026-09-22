-- S M Shahid Shah — Expo Clients
-- Run this once in Supabase SQL Editor before using /expo/.

create table if not exists public.expo_clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  whatsapp text not null,
  created_at timestamptz not null default now()
);

alter table public.expo_clients enable row level security;

-- Only authorized panel users can read Expo client records directly.
drop policy if exists "Admins read expo clients" on public.expo_clients;
create policy "Admins read expo clients"
on public.expo_clients
for select
to authenticated
using (public.is_webinar_admin());

-- Keep direct public table writes blocked. Public submissions go through the validated RPC below.
revoke all on public.expo_clients from anon;
revoke insert, update, delete on public.expo_clients from authenticated;
grant select on public.expo_clients to authenticated;

create or replace function public.submit_expo_client(
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
  v_name text := btrim(coalesce(p_name,''));
  v_email text := lower(btrim(coalesce(p_email,'')));
  v_whatsapp text := btrim(coalesce(p_whatsapp,''));
  v_digits text;
  v_id uuid;
begin
  v_digits := regexp_replace(v_whatsapp, '[^0-9]', '', 'g');

  if char_length(v_name) < 2 or char_length(v_name) > 120 then
    return jsonb_build_object('success',false,'message','Please enter a valid full name.');
  end if;

  if char_length(v_email) > 180 or v_email !~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$' then
    return jsonb_build_object('success',false,'message','Please enter a valid email address.');
  end if;

  if char_length(v_digits) < 7 or char_length(v_digits) > 18 then
    return jsonb_build_object('success',false,'message','Please enter a valid active WhatsApp number.');
  end if;

  insert into public.expo_clients(name,email,whatsapp)
  values (v_name,v_email,v_whatsapp)
  returning id into v_id;

  return jsonb_build_object('success',true,'id',v_id);
end;
$$;

revoke all on function public.submit_expo_client(text,text,text) from public;
grant execute on function public.submit_expo_client(text,text,text) to anon, authenticated;

comment on table public.expo_clients is 'Expo leads collected on /expo/ before redirecting to the external registration page.';
