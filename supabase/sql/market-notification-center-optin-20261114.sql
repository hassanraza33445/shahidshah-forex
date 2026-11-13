-- Market Intelligence V4: in-app notification feed and strictly opt-in user inbox.
-- No external push, email or SMS is sent by this migration.
CREATE TABLE IF NOT EXISTS public.market_notification_events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 dedupe_key text NOT NULL UNIQUE,
 kind text NOT NULL CHECK (kind IN ('breaking_news','economic_reminder')),
 title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 240),
 body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 600),
 topic text NOT NULL CHECK (topic IN ('Gold','Forex','Crypto','Central Banks','Economic Data','Energy','Geopolitics')),
 impact text NOT NULL DEFAULT 'WARM' CHECK (impact IN ('HOT','WARM','HIGH','MEDIUM','LOW')),
 trust_status text NOT NULL DEFAULT 'unverified' CHECK (trust_status IN ('unverified','official_schedule','verified')),
 target_url text NOT NULL CHECK (target_url LIKE 'https://%' OR target_url LIKE '/%'),
 source_article_id uuid REFERENCES public.news_articles(id) ON DELETE SET NULL,
 source_event_id uuid REFERENCES public.economic_calendar_events(id) ON DELETE SET NULL,
 reminder_minutes integer CHECK (reminder_minutes IN (0,15,60)),
 is_active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT (now()+interval '14 days'),
 CONSTRAINT notice_source_type CHECK (
   (kind='breaking_news' AND source_article_id IS NOT NULL AND source_event_id IS NULL AND reminder_minutes IS NULL)
   OR
   (kind='economic_reminder' AND source_event_id IS NOT NULL AND source_article_id IS NULL AND reminder_minutes IS NOT NULL)
 )
);
CREATE INDEX IF NOT EXISTS market_notice_latest_public ON public.market_notification_events(created_at DESC)
 WHERE is_active=true;
ALTER TABLE public.market_notification_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public active market notices" ON public.market_notification_events;
CREATE POLICY "Public active market notices" ON public.market_notification_events
 FOR SELECT TO anon,authenticated USING (is_active AND created_at<=now() AND expires_at>now());
REVOKE ALL ON TABLE public.market_notification_events FROM PUBLIC,anon,authenticated;
GRANT SELECT ON TABLE public.market_notification_events TO anon,authenticated;
GRANT ALL ON TABLE public.market_notification_events TO service_role;

CREATE TABLE IF NOT EXISTS public.market_notification_preferences(
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 in_app_enabled boolean NOT NULL DEFAULT false,
 breaking_enabled boolean NOT NULL DEFAULT false,
 economic_enabled boolean NOT NULL DEFAULT false,
 topics text[] NOT NULL DEFAULT ARRAY['Gold','Forex','Crypto','Central Banks','Economic Data']::text[],
 reminders integer[] NOT NULL DEFAULT ARRAY[60,15,0]::integer[],
 timezone text NOT NULL DEFAULT 'Asia/Kuala_Lumpur'
  CHECK(timezone IN ('Asia/Kuala_Lumpur','Asia/Karachi','America/New_York','UTC')),
 quiet_start time without time zone,
 quiet_end time without time zone,
 push_enabled boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT market_notification_topics_whitelist CHECK (
  topics <@ ARRAY['Gold','Forex','Crypto','Central Banks','Economic Data','Energy','Geopolitics']::text[]
 ),
 CONSTRAINT market_notification_reminders_whitelist CHECK (reminders <@ ARRAY[0,15,60]::integer[]),
 CONSTRAINT market_notification_quiet_hours_pair CHECK ((quiet_start IS NULL)=(quiet_end IS NULL)),
 CONSTRAINT market_notification_push_disabled_until_integrated CHECK(push_enabled=false)
);
ALTER TABLE public.market_notification_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "User can read own market notification settings" ON public.market_notification_preferences;
CREATE POLICY "User can read own market notification settings" ON public.market_notification_preferences
 FOR SELECT TO authenticated USING (user_id=(select auth.uid()));
DROP POLICY IF EXISTS "User can create own market notification settings" ON public.market_notification_preferences;
CREATE POLICY "User can create own market notification settings" ON public.market_notification_preferences
 FOR INSERT TO authenticated WITH CHECK (user_id=(select auth.uid()));
DROP POLICY IF EXISTS "User can update own market notification settings" ON public.market_notification_preferences;
CREATE POLICY "User can update own market notification settings" ON public.market_notification_preferences
 FOR UPDATE TO authenticated USING (user_id=(select auth.uid())) WITH CHECK (user_id=(select auth.uid()));
REVOKE ALL ON TABLE public.market_notification_preferences FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON TABLE public.market_notification_preferences TO authenticated;
GRANT ALL ON TABLE public.market_notification_preferences TO service_role;

CREATE TABLE IF NOT EXISTS public.market_notification_inbox(
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 notice_id uuid NOT NULL REFERENCES public.market_notification_events(id) ON DELETE CASCADE,
 queued_at timestamptz NOT NULL DEFAULT now(),
 read_at timestamptz,
 PRIMARY KEY(user_id,notice_id)
);
CREATE INDEX IF NOT EXISTS market_notification_inbox_unread ON public.market_notification_inbox(user_id,queued_at DESC) WHERE read_at IS NULL;
ALTER TABLE public.market_notification_inbox ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "User may read own notifications" ON public.market_notification_inbox;
CREATE POLICY "User may read own notifications" ON public.market_notification_inbox
 FOR SELECT TO authenticated USING (user_id=(select auth.uid()));
DROP POLICY IF EXISTS "User may mark own notifications read" ON public.market_notification_inbox;
CREATE POLICY "User may mark own notifications read" ON public.market_notification_inbox
 FOR UPDATE TO authenticated USING (user_id=(select auth.uid())) WITH CHECK (user_id=(select auth.uid()));
REVOKE ALL ON TABLE public.market_notification_inbox FROM PUBLIC,anon,authenticated;
GRANT SELECT ON TABLE public.market_notification_inbox TO authenticated;
GRANT UPDATE(read_at) ON TABLE public.market_notification_inbox TO authenticated;
GRANT ALL ON TABLE public.market_notification_inbox TO service_role;

CREATE TABLE IF NOT EXISTS public.market_notification_worker_runs(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 started_at timestamptz NOT NULL DEFAULT now(),
 news_created integer NOT NULL DEFAULT 0,
 reminders_created integer NOT NULL DEFAULT 0,
 inbox_queued integer NOT NULL DEFAULT 0,
 result text NOT NULL DEFAULT 'success' CHECK(result IN ('success','skipped','error')),
 detail text
);
ALTER TABLE public.market_notification_worker_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.market_notification_worker_runs FROM PUBLIC,anon,authenticated;
GRANT ALL ON TABLE public.market_notification_worker_runs TO service_role;

-- Cron invokes the following service-only procedure. No arbitrary URL/recipient arguments.
-- Real HOT stories remain explicitly "unverified" until human/official verification exists.
-- Exact 5-minute due windows prevent belated reminders after server outages.
CREATE OR REPLACE FUNCTION public.refresh_market_notification_feed()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_news integer:=0;v_events integer:=0;v_inbox integer:=0;
BEGIN
 IF NOT pg_catalog.pg_try_advisory_xact_lock(26411014) THEN
  RETURN pg_catalog.jsonb_build_object('status','skipped','reason','concurrent refresh');
 END IF;

 WITH candidate AS (
  SELECT a.id,a.cluster_id,a.title,a.category,a.original_url,a.publisher,a.verification_status,
   pg_catalog.row_number() OVER (
    PARTITION BY COALESCE(a.cluster_id,a.id)
    ORDER BY a.first_seen_at DESC,a.id DESC
   ) AS pos
  FROM public.news_articles a
  WHERE a.is_visible=true AND a.priority='HOT'
   AND a.first_seen_at >= now()-interval '10 minutes'
   AND a.first_seen_at <= now()
   AND COALESCE(a.published_at,a.first_seen_at)>=now()-interval '4 hours'
   AND a.original_url LIKE 'https://%'
 )
 INSERT INTO public.market_notification_events(
  dedupe_key,kind,title,body,topic,impact,trust_status,target_url,source_article_id
 )
 SELECT 'hot-news:'||COALESCE(c.cluster_id,c.id)::text,'breaking_news',
  left(c.title,240),
  left('HOT editorial headline from '||c.publisher||'. Source status: '||
   CASE WHEN c.verification_status='verified' THEN 'verified' ELSE 'unverified — verify the original report' END||'.',600),
  c.category,'HOT',
  CASE WHEN c.verification_status='verified' THEN 'verified' ELSE 'unverified' END,
  c.original_url,c.id
 FROM candidate c WHERE c.pos=1
  AND c.category IN ('Gold','Forex','Crypto','Central Banks','Economic Data','Energy','Geopolitics')
 ON CONFLICT(dedupe_key) DO NOTHING;
 GET DIAGNOSTICS v_news=ROW_COUNT;

 WITH due AS (
  SELECT e.id,e.title,e.category,e.impact,e.scheduled_at,r.minutes
  FROM public.economic_calendar_events e
  CROSS JOIN (VALUES (60),(15),(0)) AS r(minutes)
  WHERE e.is_published AND e.last_verified_at IS NOT NULL
   AND e.status='scheduled' AND e.time_precision='exact'
   AND e.impact='HIGH'
   AND e.scheduled_at-r.minutes*interval '1 minute' <= now()
   AND e.scheduled_at-r.minutes*interval '1 minute' > now()-interval '5 minutes'
 )
 INSERT INTO public.market_notification_events(
  dedupe_key,kind,title,body,topic,impact,trust_status,target_url,source_event_id,reminder_minutes
 )
 SELECT 'economic:'||d.id::text||':'||d.minutes,'economic_reminder',
  left(d.title,240),
  CASE WHEN d.minutes=0
   THEN 'Officially scheduled high-impact economic event is due now. Verify the original release time.'
   ELSE 'Officially scheduled high-impact event in '||d.minutes||' minutes. Verify the original source.' END,
  'Economic Data','HIGH','official_schedule','/economic-calendar/',d.id,d.minutes
 FROM due d ON CONFLICT(dedupe_key) DO NOTHING;
 GET DIAGNOSTICS v_events=ROW_COUNT;

 -- Inbox enrollment is opt-in. This only queues in-app items; it never sends push.
 INSERT INTO public.market_notification_inbox(user_id,notice_id)
 SELECT pref.user_id,n.id FROM public.market_notification_events n
 JOIN public.market_notification_preferences pref ON pref.in_app_enabled=true
 WHERE n.is_active AND n.created_at >= now()-interval '10 minutes'
  AND n.expires_at > now()
  AND (
   (n.kind='breaking_news' AND pref.breaking_enabled AND n.topic=ANY(pref.topics))
   OR (n.kind='economic_reminder' AND pref.economic_enabled AND n.reminder_minutes=ANY(pref.reminders))
  )
 ON CONFLICT(user_id,notice_id) DO NOTHING;
 GET DIAGNOSTICS v_inbox=ROW_COUNT;

 INSERT INTO public.market_notification_worker_runs(news_created,reminders_created,inbox_queued)
 VALUES(v_news,v_events,v_inbox);
 RETURN pg_catalog.jsonb_build_object('status','success','news_created',v_news,
  'reminders_created',v_events,'inbox_queued',v_inbox);
END $$;
REVOKE ALL ON FUNCTION public.refresh_market_notification_feed() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_market_notification_feed() TO service_role;

-- No user is subscribed by default, and no external push delivery is configured.
SELECT cron.schedule(
 'smshahid-market-notification-feed-five-minute-refresh',
 '*/5 * * * *',
 $$SELECT public.refresh_market_notification_feed();$$
);
