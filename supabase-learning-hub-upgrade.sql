-- Learning Hub CMS upgrade
create table if not exists public.learning_hub_items (
  id uuid primary key default gen_random_uuid(),
  content_type text not null check (content_type in ('ai_prompt','video_script','roadmap','resource')),
  category text not null default 'General',
  title text not null,
  description text,
  content text,
  resource_url text,
  duration text,
  display_order integer not null default 1,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists learning_hub_type_order_idx on public.learning_hub_items(content_type,display_order);
alter table public.learning_hub_items enable row level security;
drop policy if exists "Public reads published learning hub" on public.learning_hub_items;
create policy "Public reads published learning hub" on public.learning_hub_items for select to anon,authenticated using (is_published or public.is_webinar_admin());
drop policy if exists "Admins manage learning hub" on public.learning_hub_items;
create policy "Admins manage learning hub" on public.learning_hub_items for all to authenticated using (public.is_webinar_admin()) with check (public.is_webinar_admin());
grant select on public.learning_hub_items to anon,authenticated;
grant insert,update,delete on public.learning_hub_items to authenticated;
create or replace function public.set_learning_hub_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end; $$;
drop trigger if exists learning_hub_updated_at on public.learning_hub_items;
create trigger learning_hub_updated_at before update on public.learning_hub_items for each row execute function public.set_learning_hub_updated_at();
