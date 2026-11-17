-- Privileged, idempotent OneSignal single-device demo variants (17 November 2026).
-- Never creates market events, claims trading outcomes or changes automatic dispatch.
ALTER TABLE public.market_push_test_requests
ADD COLUMN IF NOT EXISTS demo_type text NOT NULL DEFAULT 'gold'
CONSTRAINT market_push_test_demo_type_check
CHECK (demo_type IN ('gold','forex','calendar','breaking'));
COMMENT ON COLUMN public.market_push_test_requests.demo_type IS
'Preapproved clearly labeled DEMO variant: gold, forex, calendar, breaking. Only service_role may create or read tests.';
