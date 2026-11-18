-- Exactly-match PipSePaisa HOT push subjects for generic breaking notifications.
-- Continue sending only explicitly user-requested keyword alerts for other
-- headlines and preserve all economic reminders and in-app news events.
-- Existing source subscriptions and quiet-hour choices remain in force.
CREATE OR REPLACE FUNCTION public.enqueue_verified_market_pushes()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
      (n.id IN (SELECT id FROM public.market_notification_events WHERE dedupe_key LIKE 'pip-hot:%') AND pref.breaking_enabled)
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
END $function$
;
REVOKE ALL ON FUNCTION public.enqueue_verified_market_pushes() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_verified_market_pushes() TO service_role;
