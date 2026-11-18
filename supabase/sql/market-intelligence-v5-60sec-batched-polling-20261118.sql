-- One-minute incremental market RSS checks for the expanded news feed registry.
-- Leave the existing HTTP cron job ID, URL and credentials unchanged.
-- Work is bounded to 56 sources/call in the Edge Function and protected by a lease.
CREATE OR REPLACE FUNCTION public.try_begin_news_ingestion()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
  UPDATE public.news_ingestion_control
     SET last_started_at=now(),
         lease_expires_at=now()+interval '4 minutes'
   WHERE id=1
     AND (last_started_at IS NULL OR last_started_at<=now()-interval '50 seconds')
     AND (
       lease_expires_at IS NULL
       OR lease_expires_at<=now()
       OR (last_finished_at IS NOT NULL AND last_finished_at>=last_started_at)
     );
  RETURN FOUND;
END;
$$;

DO $job$
DECLARE v_job bigint;
BEGIN
  SELECT jobid INTO v_job FROM cron.job
   WHERE jobname='smshahid-market-intelligence-three-minute-refresh';
  IF v_job IS NULL THEN
    RAISE EXCEPTION 'Expected market refresh cron job is absent; refusing to create an unverified HTTP schedule';
  END IF;
  PERFORM cron.alter_job(job_id:=v_job,schedule:='* * * * *');
END
$job$;
