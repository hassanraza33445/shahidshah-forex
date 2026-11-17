-- All-News Real Push Phase 5, 17 Nov 2026.
-- Only *newly seen* visible source-linked news, all priorities (HOT/WARM/COLD).
-- Unverified sources are explicitly labeled; this does not assert independent verification.
-- Existing subscribed users retain opt-in and can disable the sidebar switch anytime.
-- No historical backfill beyond 10 minutes and dedupe by story cluster.
ALTER TABLE public.market_notification_events DROP CONSTRAINT IF EXISTS market_notification_events_impact_check;
ALTER TABLE public.market_notification_events ADD CONSTRAINT market_notification_events_impact_check
 CHECK (impact IN ('HOT','WARM','COLD','HIGH','MEDIUM','LOW'));

CREATE TABLE IF NOT EXISTS public.market_push_runtime (
 id boolean PRIMARY KEY DEFAULT true CHECK(id),
 dispatch_enabled boolean NOT NULL DEFAULT false,
 run_token uuid NOT NULL DEFAULT gen_random_uuid(),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.market_push_runtime ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.market_push_runtime FROM PUBLIC,anon,authenticated;
GRANT SELECT,UPDATE ON TABLE public.market_push_runtime TO service_role;
INSERT INTO public.market_push_runtime(id,dispatch_enabled) VALUES (true,false) ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.refresh_market_notification_feed()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_news integer:=0;v_events integer:=0;v_inbox integer:=0;
BEGIN
 IF NOT pg_catalog.pg_try_advisory_xact_lock(26411014) THEN
  RETURN pg_catalog.jsonb_build_object('status','skipped','reason','concurrent refresh');
 END IF;

 WITH candidate AS (
  SELECT a.id,a.cluster_id,a.title,a.category,a.original_url,a.publisher,a.verification_status,a.priority,
   pg_catalog.row_number() OVER (
    PARTITION BY COALESCE(a.cluster_id,a.id)
    ORDER BY a.first_seen_at DESC,a.id DESC
   ) AS pos
  FROM public.news_articles a
  WHERE a.is_visible=true AND a.priority IN ('HOT','WARM','COLD')
   AND a.first_seen_at >= now()-interval '10 minutes'
   AND a.first_seen_at <= now()
   AND COALESCE(a.published_at,a.first_seen_at)>=now()-interval '4 hours'
   AND a.original_url LIKE 'https://%'
 )
 INSERT INTO public.market_notification_events(
  dedupe_key,kind,title,body,topic,impact,trust_status,target_url,source_article_id
 )
 SELECT 'news:'||COALESCE(c.cluster_id,c.id)::text,'breaking_news',
  left(c.title,240),
  left('Source headline ('||c.priority||') from '||c.publisher||'. Source status: '||
   CASE WHEN c.verification_status='verified' THEN 'verified' ELSE 'unverified — verify the original report' END||'.',600),
  c.category,c.priority,
  CASE WHEN c.verification_status='verified' THEN 'verified' ELSE 'unverified' END,
  c.original_url,c.id
 FROM candidate c WHERE c.pos=1
  AND c.category IN ('Gold','Forex','Crypto','Central Banks','Economic Data','Energy','Geopolitics')
  AND NOT EXISTS (SELECT 1 FROM public.market_notification_events old WHERE old.dedupe_key='hot-news:'||COALESCE(c.cluster_id,c.id)::text)
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
   (
    n.kind='breaking_news' AND n.topic=ANY(pref.topics)
    AND (
      pref.breaking_enabled
      OR (
        pref.keyword_alerts_enabled
        AND EXISTS (
          SELECT 1
          FROM public.news_keyword_watchlists w
          JOIN public.news_articles a ON a.id=n.source_article_id
          WHERE w.user_id=pref.user_id AND w.enabled
            AND (w.category IS NULL OR w.category=n.topic)
            AND pg_catalog.strpos(pg_catalog.lower(a.title),pg_catalog.lower(w.keyword))>0
        )
      )
    )
  )
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

-- Push eligibility: push_enabled, browser consent, HTTPS source-linked new headlines (including transparently labeled unverified),
-- topic allowlist, quiet hours, and unique (notice_id, subscription_id).
CREATE OR REPLACE FUNCTION public.enqueue_verified_market_pushes()
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE inserted_count integer:=0;
BEGIN
 WITH due AS(
   SELECT n.id,n.kind,n.topic,n.reminder_minutes,n.source_article_id,n.trust_status,n.created_at
   FROM public.market_notification_events n
   WHERE n.is_active AND n.expires_at>now() AND n.created_at<=now()
   AND (
     (n.kind='economic_reminder' AND n.trust_status='official_schedule'
      AND n.created_at>=now()-interval '8 minutes')
     OR
     (n.kind='breaking_news' AND n.trust_status IN ('verified','unverified')
      AND n.created_at>=now()-interval '12 minutes')
   )
 )
 INSERT INTO public.market_push_deliveries(notice_id,subscription_id,user_id)
 SELECT n.id,sub.subscription_id,sub.user_id
 FROM due n
 JOIN public.market_notification_preferences pref
   ON pref.push_enabled AND pref.in_app_enabled
   AND ((
    n.kind='breaking_news' AND n.topic=ANY(pref.topics)
    AND (
      pref.breaking_enabled
      OR (
        pref.keyword_alerts_enabled
        AND EXISTS (
          SELECT 1
          FROM public.news_keyword_watchlists w
          JOIN public.news_articles a ON a.id=n.source_article_id
          WHERE w.user_id=pref.user_id AND w.enabled
            AND (w.category IS NULL OR w.category=n.topic)
            AND pg_catalog.strpos(pg_catalog.lower(a.title),pg_catalog.lower(w.keyword))>0
        )
      )
    )
  )
    OR (n.kind='economic_reminder' AND pref.economic_enabled AND n.reminder_minutes=ANY(pref.reminders)))
 JOIN public.market_push_subscriptions sub
   ON sub.user_id=pref.user_id AND sub.active AND sub.browser_permission_granted
 ON CONFLICT(notice_id,subscription_id) DO NOTHING;
 GET DIAGNOSTICS inserted_count=ROW_COUNT;
 RETURN pg_catalog.jsonb_build_object('queued',inserted_count,'status','ok');
END $$;
REVOKE ALL ON FUNCTION public.enqueue_verified_market_pushes() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_verified_market_pushes() TO service_role;

-- Cron performs a public POST with an unguessable token generated and held
-- entirely inside private Postgres. Neither service-role secrets nor OneSignal
-- REST API keys are ever embedded in cron jobs or frontend bundles.
-- The backend re-checks this private token + enabled flag on every run.
SELECT cron.schedule(
 'smshahid-real-all-news-push-every-minute',
 '* * * * *',
 $job$
 SELECT net.http_post(
   url:='https://qggtdwixwafcmorepkks.supabase.co/functions/v1/market-push-dispatch',
   headers:=jsonb_build_object(
     'Content-Type','application/json',
     'x-dispatch-key',
     (SELECT run_token::text FROM public.market_push_runtime
       WHERE id=true AND dispatch_enabled=true)
   ),
   body:='{}'::jsonb,
   timeout_milliseconds:=25000
 )
 WHERE EXISTS(
   SELECT 1 FROM public.market_push_runtime WHERE id=true AND dispatch_enabled=true
 );
 $job$
);
