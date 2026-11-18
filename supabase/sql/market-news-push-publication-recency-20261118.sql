-- Production hotfix applied 2026-11-18: newly discovered RSS articles can be
-- hours old during initial source import. Show them in news feeds, but do not
-- send notifications until publication is truly recent (30m max).
-- This is the exact replacement for refresh_market_notification_feed().
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
   AND COALESCE(a.published_at,a.first_seen_at)>=now()-interval '30 minutes'
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
