
-- Market News Phase 3: private Saved Articles and Keyword Watchlists (additive).
-- Existing news records, article URLs, roles and OneSignal preferences stay unchanged.
CREATE TABLE IF NOT EXISTS public.news_saved_articles (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  article_id uuid NOT NULL REFERENCES public.news_articles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, article_id)
);
CREATE INDEX IF NOT EXISTS news_saved_recent_user_idx ON public.news_saved_articles (user_id, created_at DESC);
ALTER TABLE public.news_saved_articles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "News user reads own saved articles" ON public.news_saved_articles;
CREATE POLICY "News user reads own saved articles" ON public.news_saved_articles FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "News user saves own published articles" ON public.news_saved_articles;
CREATE POLICY "News user saves own published articles" ON public.news_saved_articles FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (SELECT 1 FROM public.news_articles a WHERE a.id = article_id AND a.is_visible = true)
  );
DROP POLICY IF EXISTS "News user removes own saved articles" ON public.news_saved_articles;
CREATE POLICY "News user removes own saved articles" ON public.news_saved_articles FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));
REVOKE ALL ON public.news_saved_articles FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.news_saved_articles TO authenticated;
GRANT ALL ON public.news_saved_articles TO service_role;

CREATE TABLE IF NOT EXISTS public.news_keyword_watchlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  keyword text NOT NULL CHECK (char_length(keyword) BETWEEN 2 AND 70 AND keyword = btrim(keyword)),
  category text NULL CHECK (category IS NULL OR category IN ('Gold','Forex','Crypto','Central Banks','Economic Data','Energy','Geopolitics','Markets')),
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS news_keyword_watchlists_unique_user_keyword_category
  ON public.news_keyword_watchlists (user_id,lower(keyword),coalesce(category,''));
CREATE INDEX IF NOT EXISTS news_keyword_watchlists_user_created_idx
  ON public.news_keyword_watchlists (user_id,created_at DESC);
ALTER TABLE public.news_keyword_watchlists ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "News user reads own watchlist" ON public.news_keyword_watchlists;
CREATE POLICY "News user reads own watchlist" ON public.news_keyword_watchlists FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "News user adds own watchlist" ON public.news_keyword_watchlists;
CREATE POLICY "News user adds own watchlist" ON public.news_keyword_watchlists FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "News user updates own watchlist" ON public.news_keyword_watchlists;
CREATE POLICY "News user updates own watchlist" ON public.news_keyword_watchlists FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "News user removes own watchlist" ON public.news_keyword_watchlists;
CREATE POLICY "News user removes own watchlist" ON public.news_keyword_watchlists FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));
REVOKE ALL ON public.news_keyword_watchlists FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.news_keyword_watchlists TO authenticated;
GRANT ALL ON public.news_keyword_watchlists TO service_role;
