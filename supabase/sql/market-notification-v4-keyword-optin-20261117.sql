-- Phase 4: Keyword HOT alerts + strict per-user double opt-in.
-- Only new HOT market_notification_events; no fabricated news, no user auto-enrolment.
-- Source verification remains mandatory for any external OneSignal push.
-- Existing notification preferences are preserved and keyword alerts default OFF.
ALTER TABLE public.market_notification_preferences
 ADD COLUMN IF NOT EXISTS keyword_alerts_enabled boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.market_notification_preferences.keyword_alerts_enabled IS
 'Explicit opt-in for in-app and verified browser push alerts matching enabled user keyword watchlists.';

-- Critical: re-use the existing 5-minute worker and its event-key and user-key uniqueness.
-- Watches are literal, case-insensitive substrings; no untrusted LIKE/regex wildcards.
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

-- All push eligibility checks remain: push_enabled, browser consent, verified HOT news,
-- topic allowlist, quiet hours, and unique (notice_id, subscription_id).
CREATE OR REPLACE FUNCTION public.enqueue_verified_market_pushes()
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE inserted_count integer:=0;
BEGIN
 WITH due AS(
   SELECT n.id,n.kind,n.topic,n.reminder_minutes,n.trust_status,n.created_at
   FROM public.market_notification_events n
   WHERE n.is_active AND n.expires_at>now() AND n.created_at<=now()
   AND (
     (n.kind='economic_reminder' AND n.trust_status='official_schedule'
      AND n.created_at>=now()-interval '8 minutes')
     OR
     (n.kind='breaking_news' AND n.trust_status='verified'
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
