-- One-time, server-invoked OneSignal delivery test. Never a broadcast or scheduled dispatcher.
-- Only privileged SQL can issue the token; public and member roles cannot read or create test requests.
CREATE TABLE IF NOT EXISTS public.market_push_test_requests (
  token uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id uuid NOT NULL REFERENCES public.market_push_subscriptions(subscription_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '2 minutes',
  used_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sending','accepted','failed','no_recipient')),
  provider_message_id text,
  error_summary text,
  CONSTRAINT one_test_only_valid_window CHECK (expires_at > created_at AND expires_at <= created_at + interval '3 minutes')
);
CREATE INDEX IF NOT EXISTS market_push_test_created_idx ON public.market_push_test_requests(created_at DESC);
ALTER TABLE public.market_push_test_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.market_push_test_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.market_push_test_requests TO service_role;
COMMENT ON TABLE public.market_push_test_requests IS
 'One-off privileged OneSignal test requests for a single opted-in browser. No public RPC or public role access.';
