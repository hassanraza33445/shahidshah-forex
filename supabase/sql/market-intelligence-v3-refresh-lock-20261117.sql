-- Market Intelligence V3: reclaim a finished lease without waiting four minutes.
-- The four-minute lease remains a crash recovery watchdog.
-- The two-minute minimum start spacing prevents pageview-triggered stampedes.
-- One atomic UPDATE claims refresh work; service-role RPC only.
CREATE OR REPLACE FUNCTION public.try_begin_news_ingestion()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  UPDATE public.news_ingestion_control
     SET last_started_at = now(),
         lease_expires_at = now() + interval '4 minutes'
   WHERE id = 1
     AND (last_started_at IS NULL OR last_started_at <= now() - interval '2 minutes')
     AND (
       lease_expires_at IS NULL
       OR lease_expires_at <= now()
       OR (last_finished_at IS NOT NULL AND last_finished_at >= last_started_at)
     );
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.try_begin_news_ingestion() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.try_begin_news_ingestion() TO service_role;
