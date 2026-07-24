-- S M Shahid Shah Prompt Builder CMS
-- Safe additive migration: does not modify webinar, Zoom, email, registration, review or analytics tables.
create table if not exists public.prompt_builder_templates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug in ('video','banner','30days','article','h1','indicator')),
  title text not null,
  description text,
  master_prompt text not null check (position('{{DETAILS}}' in master_prompt) > 0),
  disclaimer text,
  form_schema jsonb not null default '[]'::jsonb check (jsonb_typeof(form_schema)='array'),
  display_order integer not null default 1,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.prompt_builder_templates enable row level security;
drop policy if exists "Public reads prompt builders" on public.prompt_builder_templates;
create policy "Public reads prompt builders" on public.prompt_builder_templates for select to anon,authenticated using (is_published or public.is_webinar_admin());
drop policy if exists "Admins manage prompt builders" on public.prompt_builder_templates;
create policy "Admins manage prompt builders" on public.prompt_builder_templates for all to authenticated using (public.is_webinar_admin()) with check (public.is_webinar_admin());
grant select on public.prompt_builder_templates to anon,authenticated;
grant insert,update,delete on public.prompt_builder_templates to authenticated;
create or replace function public.set_prompt_builder_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end; $$;
drop trigger if exists prompt_builder_updated_at on public.prompt_builder_templates;
create trigger prompt_builder_updated_at before update on public.prompt_builder_templates for each row execute function public.set_prompt_builder_updated_at();

insert into public.prompt_builder_templates(slug,title,description,master_prompt,disclaimer,form_schema,display_order) values
('video','Professional Video Script Prompt','Create structured video scripts with hooks, scenes, voice-over and a natural CTA.',
$$Act as a senior video scriptwriter and content strategist. Create a complete, original video script from these details:

{{DETAILS}}

Step 1 — Create five hook options and select the strongest.
Step 2 — Write a short, relevant introduction.
Step 3 — Build the main content with clear points and smooth transitions.
Step 4 — Add a useful example where appropriate.
Step 5 — Add on-screen text, scene and B-roll suggestions in brackets.
Step 6 — End with a key takeaway and natural CTA.

Adapt pacing to the platform and duration. If details are missing, make sensible professional decisions and state important assumptions. Use natural language, avoid repetition, and never invent facts, statistics, testimonials or guarantees. Return clearly labelled sections.$$,
'Review facts, claims, pronunciation and brand wording before recording or publishing.',
'[["topic","Video Topic","e.g. 5 mistakes new business owners make",true],["brand"],["platform","Platform","e.g. YouTube, TikTok, Instagram Reel"],["duration","Video Duration","e.g. 60 seconds or 8 minutes"],["audience"],["language"],["style"],["goal","Main Goal","e.g. Educate, build trust, promote a service"]]'::jsonb,1),
('banner','High-Converting Banner Prompt','AI creates the headline, supporting copy, CTA, layout and complete image prompt.',
$$Act as a senior advertising copywriter, art director and AI image-prompt specialist. Develop a complete banner concept from:

{{DETAILS}}

Step 1 — Create five accurate headline options and select the strongest.
Step 2 — Write concise supporting text and a natural CTA.
Step 3 — Decide the content hierarchy and premium visual direction.
Step 4 — Define background, subject, objects, lighting and composition.
Step 5 — Choose readable typography and a high-contrast colour palette when missing.
Step 6 — Produce one final detailed image-generation prompt using the requested dimensions.

Keep text inside safe margins. Do not invent prices, offers, awards, ratings or claims. If information is missing, make a sensible professional decision. Return headline options, selected copy, layout plan and final image prompt.$$,
'AI image tools may misspell text. Verify brand names, prices, offers, dates and claims before publishing.',
'[["purpose","What is the banner for?","e.g. Promote a free forex trading webinar",true],["brand"],["business","Product or Service","e.g. Forex education course"],["offer","Offer or Important Detail","e.g. Free beginner trading lesson"],["audience"],["colours","Preferred Colours","e.g. Navy, orange and gold"],["size","Banner Size","e.g. 1300×500 px"],["language"]]'::jsonb,2),
('30days','30-Day Video Content Plan','Generate a balanced month of video ideas, hooks and publishing guidance.',
$$Act as a senior social-media strategist. Create a practical 30-day video content plan from:

{{DETAILS}}

Step 1 — Define four content pillars: education, storytelling, engagement and promotion.
Step 2 — Create 30 distinct ideas without repetition.
Step 3 — For every day include title, hook, core message, format, CTA and duration.
Step 4 — Arrange the calendar so trust-building content supports promotions.
Step 5 — Add a weekly recording and scheduling workflow.
Step 6 — Add five reusable engagement ideas.

Keep every idea realistic and relevant. If details are missing, choose suitable options. Never invent business results, customer stories or statistics. Present Day 1 through Day 30 clearly.$$,
'Check facts and adapt the plan to your real audience, resources and platform rules before posting.',
'[["niche","Business, Niche or Topic","e.g. Forex education for beginners",true],["brand"],["goal","Main Content Goal","e.g. Educate traders and build trust"],["platform","Main Platform","e.g. YouTube and Instagram Reels"],["audience"],["frequency","Posting Preference","e.g. One video daily"],["language"],["style"]]'::jsonb,3),
('article','Professional Daily Article Prompt','Create an SEO-aware brief and article from a simple topic.',
$$Act as a senior editor, researcher and SEO content writer. Create an original useful article from:

{{DETAILS}}

Step 1 — Identify likely search intent.
Step 2 — Create five accurate title options and select the best.
Step 3 — Build a logical H1, H2 and H3 outline.
Step 4 — Write the introduction, detailed sections, examples and conclusion.
Step 5 — Suggest a meta title, meta description and natural keywords.
Step 6 — Add a fact-check list for claims requiring verification.

Prioritize usefulness over keyword repetition. Never invent sources, quotes, studies, statistics or current facts. Mark information requiring current research and use original wording.$$,
'Verify facts, sources, dates, legal claims and statistics. Edit AI output before publication.',
'[["topic","Article Topic or Industry","e.g. How market structure works in forex",true],["brand"],["goal","Article Goal","e.g. Educate traders and build authority"],["audience"],["length","Preferred Length","e.g. 1,200 words"],["keywords","Keywords, if known","e.g. forex market structure, price action"],["language"],["style"]]'::jsonb,4),
('h1','Daily H1 Market Analysis Prompt','Create a structured educational H1 overview without guaranteed trade calls.',
$$Act as an educational market-analysis assistant. Organize an H1 chart overview using only the supplied observations. Do not claim access to live prices or unseen chart data.

{{DETAILS}}

Step 1 — State available and missing information.
Step 2 — Describe reported H1 structure only when supported by user notes.
Step 3 — Organize supplied support, resistance, supply and demand zones.
Step 4 — Present bullish, bearish and neutral scenarios using conditional if/then language.
Step 5 — List confirmation factors and invalidation conditions to observe.
Step 6 — Add a checklist for news awareness, volatility and risk planning.

This is educational analysis, not a signal. Never invent live prices, indicators, news or chart observations. Avoid instructions to enter, exit or size a real-money trade.$$,
'Educational use only—not financial advice or a trading signal. Verify live data independently and seek qualified guidance before financial decisions.',
'[["market","Market or Symbol","e.g. XAUUSD, EURUSD",true],["session","Trading Session","e.g. London or New York"],["context","What do you see?","e.g. Price near H1 resistance after bullish BOS"],["levels","Important Levels","e.g. Support 2340, resistance 2420"],["method","Analysis Method","e.g. Price action or SMC"],["language"],["style"]]'::jsonb,5),
('indicator','Indicator Development Prompt','Turn an indicator idea into clear logic, rules, alerts and testing steps.',
$$Act as a senior indicator product designer and software-specification writer. Convert the idea into a precise developer-ready prompt. Never imply an untested strategy is profitable.

{{DETAILS}}

Step 1 — Restate purpose and assumptions in plain language.
Step 2 — Define inputs, calculations, conditions and state changes.
Step 3 — Define plots, colours, labels, panels and alerts.
Step 4 — Identify repainting risks, missing-data behaviour and edge cases.
Step 5 — Create pseudocode and a modular implementation plan.
Step 6 — Create a multi-symbol and multi-timeframe testing checklist.
Step 7 — Produce a final coding prompt with comments and configurable inputs.

Explain platform limitations. Never claim profitability or fabricate backtest results. Use safe configurable defaults and label assumptions. Require compilation checks and testing before real-world use.$$,
'Generated code may contain errors. It must be reviewed, compiled and safely tested and does not guarantee performance.',
'[["idea","Describe Your Indicator Idea","e.g. Show trend when EMA aligns with market structure",true],["platform","Platform or Language","e.g. TradingView Pine Script, MQL5"],["market","Intended Market","e.g. Forex and gold"],["timeframe","Preferred Timeframe","e.g. H1 and H4"],["inputs","Inputs or Rules","e.g. EMA 50, optional alerts"],["output","Desired Display","e.g. Trend panel and alerts"],["language"],["style"]]'::jsonb,6)
on conflict(slug) do update set title=excluded.title,description=excluded.description,master_prompt=excluded.master_prompt,disclaimer=excluded.disclaimer,form_schema=excluded.form_schema,display_order=excluded.display_order,updated_at=now();

-- Final-output behavior: copied prompts start the requested task directly.
update public.prompt_builder_templates set master_prompt =
  (case slug
    when 'video' then 'Start immediately and write the complete final video script. Do not return another prompt, brief or approval request.'
    when 'banner' then 'Generate the complete final promotional banner image immediately. Do not return another prompt, design brief, approval request or follow-up question.'
    when '30days' then 'Start immediately and deliver the complete final 30-day video content plan. Do not return another prompt or ask for approval.'
    when 'article' then 'Start immediately and write the complete final article. Do not return another prompt, outline for approval or follow-up question.'
    when 'h1' then 'Start immediately and deliver the complete educational H1 market analysis using only the supplied information.'
    when 'indicator' then 'Start immediately and create the complete indicator specification and code for the selected platform. Do not return another coding prompt.'
  end) || E' Make professional decisions for missing optional details.\n\n' || substring(master_prompt from position('{{DETAILS}}' in master_prompt));
update public.prompt_builder_templates set master_prompt=replace(replace(master_prompt,
  'Produce one final, detailed AI image-generation prompt using the exact requested dimensions.',
  'Render the finished banner image in the exact requested dimensions.'),
  'Return: headline options, selected copy, layout plan, and final image prompt.',
  'Deliver the finished banner image directly, not instructions for making it.') where slug='banner';

-- Forex-only neutral examples shown inside the public forms.
update public.prompt_builder_templates set form_schema=case slug
when 'video' then '[["topic","Video Topic","e.g. What is Forex Trading?",true],["brand"],["platform","Platform","e.g. YouTube"],["duration","Video Duration","e.g. 60 seconds"],["audience"],["language"],["style"],["goal","Main Goal","e.g. Explain the topic clearly"]]'::jsonb
when 'banner' then '[["purpose","What is the banner for?","e.g. Promote Free Forex Education",true],["brand"],["business","Product or Service","e.g. Forex Learning Course"],["offer","Offer or Important Detail","e.g. Free Trading Lessons"],["audience"],["colours","Preferred Colours","e.g. Orange, black and gold"],["size","Banner Size","e.g. 1080×1080 px"],["language"]]'::jsonb
when '30days' then '[["niche","Business, Niche or Topic","e.g. Forex Education",true],["brand"],["goal","Main Content Goal","e.g. Educate Beginner Traders"],["platform","Main Platform","e.g. YouTube, TikTok or Instagram"],["audience"],["frequency","Posting Preference","e.g. One Educational Video Daily"],["language"],["style"]]'::jsonb
when 'article' then '[["topic","Article Topic or Industry","e.g. How Market Structure Works",true],["brand"],["goal","Article Goal","e.g. Educate Beginner Traders"],["audience"],["length","Preferred Length","e.g. 1,200 words"],["keywords","Keywords, if known","e.g. Market Structure, Forex Education, Price Action"],["language"],["style"]]'::jsonb
else form_schema end;

-- Admin-managed download cards. Additive and isolated from webinar systems.
create table if not exists public.download_resources (
  id uuid primary key default gen_random_uuid(), title text not null, caption text,
  thumbnail_url text, download_url text not null, display_order integer not null default 1,
  is_published boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.download_resources enable row level security;
drop policy if exists "Public reads downloads" on public.download_resources;
create policy "Public reads downloads" on public.download_resources for select to anon,authenticated using (is_published or public.is_webinar_admin());
drop policy if exists "Admins manage downloads" on public.download_resources;
create policy "Admins manage downloads" on public.download_resources for all to authenticated using (public.is_webinar_admin()) with check (public.is_webinar_admin());
grant select on public.download_resources to anon,authenticated;
grant insert,update,delete on public.download_resources to authenticated;

-- Public storage used by the Downloads admin uploader.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('download-assets','download-assets',true,10485760,array[
  'image/png','image/jpeg','image/webp','text/csv','application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/pdf'
]) on conflict (id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "Public reads download assets" on storage.objects;
create policy "Public reads download assets" on storage.objects for select to public using (bucket_id='download-assets');
drop policy if exists "Admin uploads download assets" on storage.objects;
create policy "Admin uploads download assets" on storage.objects for insert to authenticated with check (bucket_id='download-assets' and public.is_webinar_admin());
drop policy if exists "Admin updates download assets" on storage.objects;
create policy "Admin updates download assets" on storage.objects for update to authenticated using (bucket_id='download-assets' and public.is_webinar_admin()) with check (bucket_id='download-assets' and public.is_webinar_admin());
drop policy if exists "Admin deletes download assets" on storage.objects;
create policy "Admin deletes download assets" on storage.objects for delete to authenticated using (bucket_id='download-assets' and public.is_webinar_admin());
