-- OneSignal Web Push V1 — private, explicit subscription consent and idempotent delivery.
-- No device will subscribe without explicit browser permission & signed-in user action.
-- Existing in-app feed and cron remain unchanged.
ALTER TABLE public.market_notification_preferences
 DROP CONSTRAINT IF EXISTS market_notification_push_disabled_until_integrated;

CREATE TABLE IF NOT EXISTS public.market_push_subscriptions(
 subscription_id uuid PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 origin text NOT NULL DEFAULT 'https://www.smshahidshah.com'
  CHECK(origin='https://www.smshahidshah.com'),
 active boolean NOT NULL DEFAULT true,
 browser_permission_granted boolean NOT NULL DEFAULT false,
 consented_at timestamptz NOT NULL DEFAULT now(),
 last_seen_at timestamptz NOT NULL DEFAULT now(),
 disabled_at timestamptz
);
CREATE INDEX IF NOT EXISTS market_push_subscriptions_by_user ON public.market_push_subscriptions(user_id,active);
ALTER TABLE public.market_push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users may see own OneSignal device IDs" ON public.market_push_subscriptions;
CREATE POLICY "Users may see own OneSignal device IDs" ON public.market_push_subscriptions
 FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));
REVOKE ALL ON public.market_push_subscriptions FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.market_push_subscriptions TO authenticated;
GRANT ALL ON public.market_push_subscriptions TO service_role;

CREATE TABLE IF NOT EXISTS public.market_push_deliveries(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 notice_id uuid NOT NULL REFERENCES public.market_notification_events(id) ON DELETE CASCADE,
 subscription_id uuid NOT NULL REFERENCES public.market_push_subscriptions(subscription_id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 idempotency_key uuid NOT NULL DEFAULT gen_random_uuid(),
 state text NOT NULL DEFAULT 'pending'
  CHECK(state IN ('pending','sending','retry','sent','no_recipient','expired','quiet_hours','failed')),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 8),
 locked_until timestamptz,
 next_attempt_at timestamptz NOT NULL DEFAULT now(),
 provider_message_id text,
 last_error text,
 created_at timestamptz NOT NULL DEFAULT now(),
 processed_at timestamptz,
 UNIQUE(notice_id,subscription_id),
 UNIQUE(idempotency_key)
);
CREATE INDEX IF NOT EXISTS market_push_deliveries_due ON public.market_push_deliveries(next_attempt_at)
 WHERE state IN ('pending','retry','sending');
ALTER TABLE public.market_push_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.market_push_deliveries FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.market_push_deliveries TO service_role;

-- Source verification and deliberate opt-in are mandatory. HOT alone is insufficient for push.
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
   AND ((n.kind='breaking_news' AND pref.breaking_enabled AND n.topic=ANY(pref.topics))
    OR (n.kind='economic_reminder' AND pref.economic_enabled AND n.reminder_minutes=ANY(pref.reminders)))
 JOIN public.market_push_subscriptions sub
   ON sub.user_id=pref.user_id AND sub.active AND sub.browser_permission_granted
 ON CONFLICT(notice_id,subscription_id) DO NOTHING;
 GET DIAGNOSTICS inserted_count=ROW_COUNT;
 RETURN pg_catalog.jsonb_build_object('queued',inserted_count,'status','ok');
END $$;
REVOKE ALL ON FUNCTION public.enqueue_verified_market_pushes() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_verified_market_pushes() TO service_role;

-- Lock jobs atomically so concurrent dispatchers cannot send duplicates.
CREATE OR REPLACE FUNCTION public.claim_market_push_deliveries(p_limit integer DEFAULT 10)
RETURNS SETOF public.market_push_deliveries
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
 RETURN QUERY
 WITH eligible AS(
 SELECT j.id FROM public.market_push_deliveries j
 WHERE (j.state IN ('pending','retry') AND j.next_attempt_at<=now())
    OR (j.state='sending' AND j.locked_until<now())
 ORDER BY j.created_at ASC
 LIMIT LEAST(GREATEST(COALESCE(p_limit,10),1),20)
 FOR UPDATE SKIP LOCKED
 )
 UPDATE public.market_push_deliveries j
 SET state='sending',attempts=j.attempts+1,locked_until=now()+interval '2 minutes'
 FROM eligible e WHERE j.id=e.id
 RETURNING j.*;
END $$;
REVOKE ALL ON FUNCTION public.claim_market_push_deliveries(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_market_push_deliveries(integer) TO service_role;

-- Intentionally NO dispatch cron until OneSignal credentials and end-to-end consent are validated.
-- Do not add a publicly-callable HTTP scheduler or put API keys into cron.job commands.
