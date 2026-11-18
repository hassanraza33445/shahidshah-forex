-- S M Shahid Shah: one-minute mirror of already-sent PipSePaisa HOT
-- notifications. No cross-project secret is passed. The existing private
-- dispatch token authorizes this new worker, exactly like market-push-dispatch.
-- Calls are asynchronous; mirror events are deduplicated by article URL.
DO $job$
BEGIN
 IF NOT EXISTS (
  SELECT 1 FROM cron.job WHERE jobname='smshahid-pip-hot-push-mirror-one-minute'
 ) THEN
  PERFORM cron.schedule(
   'smshahid-pip-hot-push-mirror-one-minute',
   '* * * * *',
   $cmd$
   SELECT net.http_post(
     url:='https://qggtdwixwafcmorepkks.supabase.co/functions/v1/pip-hot-mirror-sync',
     headers:=jsonb_build_object(
       'Content-Type','application/json',
       'x-dispatch-key',
       (SELECT run_token::text FROM public.market_push_runtime
         WHERE id=true AND dispatch_enabled=true)
     ),
     body:='{}'::jsonb,
     timeout_milliseconds:=25000
   )
   WHERE EXISTS (
     SELECT 1 FROM public.market_push_runtime
     WHERE id=true AND dispatch_enabled=true
   );
   $cmd$
  );
 END IF;
END
$job$;
