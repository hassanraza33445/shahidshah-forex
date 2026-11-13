-- Global Market Intelligence V2: lossless story grouping and controlled retry metadata.
-- Existing news_article IDs, URLs, visibility and user data remain unchanged.
ALTER TABLE public.news_sources ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz;
ALTER TABLE public.news_sources ADD COLUMN IF NOT EXISTS next_retry_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS news_story_clusters_topic_unique
  ON public.news_story_clusters(topic);
CREATE INDEX IF NOT EXISTS news_articles_cluster_latest_idx
  ON public.news_articles(cluster_id,published_at DESC)
  WHERE cluster_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS news_sources_next_retry_idx
  ON public.news_sources(enabled,next_retry_at);

CREATE OR REPLACE FUNCTION public.refresh_news_story_clusters()
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE linked integer := 0;
DECLARE new_clusters integer := 0;
BEGIN
  WITH story_keys AS (
    SELECT DISTINCT (
       coalesce(a.category,'Markets') || '|' ||
       to_char(coalesce(a.published_at,a.first_seen_at) AT TIME ZONE 'UTC','YYYY-MM-DD') || '|' ||
       coalesce(nullif(a.fingerprint,''),lower(a.title))
    ) AS topic
    FROM public.news_articles a
    WHERE a.cluster_id IS NULL
  )
  INSERT INTO public.news_story_clusters(topic)
    SELECT topic FROM story_keys
  ON CONFLICT(topic) DO NOTHING;
  GET DIAGNOSTICS new_clusters = ROW_COUNT;

  UPDATE public.news_articles a
     SET cluster_id = c.id
    FROM public.news_story_clusters c
   WHERE a.cluster_id IS NULL
     AND c.topic = (
       coalesce(a.category,'Markets') || '|' ||
       to_char(coalesce(a.published_at,a.first_seen_at) AT TIME ZONE 'UTC','YYYY-MM-DD') || '|' ||
       coalesce(nullif(a.fingerprint,''),lower(a.title))
     );
  GET DIAGNOSTICS linked = ROW_COUNT;
  RETURN jsonb_build_object('linked_articles',linked,'new_clusters',new_clusters);
END $$;

REVOKE ALL ON FUNCTION public.refresh_news_story_clusters() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_news_story_clusters() TO service_role;

-- Stable paginated feed, one representative per strict same-headline/day/category cluster.
-- Preserve source articles. Never coalesce loosely similar event headlines.
CREATE OR REPLACE FUNCTION public.market_news_feed_v2(
  p_category text DEFAULT NULL,
  p_priority text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_limit integer DEFAULT 24,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid, title text, summary text, publisher text, original_url text,
  published_at timestamptz, category text, priority text, priority_reason text,
  verification_status text, cluster_id uuid, source_count bigint
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$
  WITH candidates AS (
    SELECT a.id,a.title,a.summary,a.publisher,a.original_url,a.published_at,
           a.category,a.priority,a.priority_reason,a.verification_status,a.cluster_id,
           row_number() OVER (
             PARTITION BY coalesce(a.cluster_id::text,a.id::text)
             ORDER BY a.published_at DESC NULLS LAST,a.id DESC
           ) AS row_num
    FROM public.news_articles a
    WHERE a.is_visible
      AND (nullif(p_category,'') IS NULL OR a.category=p_category)
      AND (nullif(p_priority,'') IS NULL OR a.priority=p_priority)
      AND (nullif(p_search,'') IS NULL OR a.title ILIKE '%' || p_search || '%')
  )
  SELECT c.id,c.title,c.summary,c.publisher,c.original_url,c.published_at,
         c.category,c.priority,c.priority_reason,c.verification_status,c.cluster_id,
         CASE WHEN c.cluster_id IS NULL THEN 1::bigint
              ELSE (SELECT count(*) FROM public.news_articles b
                    WHERE b.cluster_id=c.cluster_id AND b.is_visible) END AS source_count
    FROM candidates c
   WHERE c.row_num=1
   ORDER BY c.published_at DESC NULLS LAST,c.id DESC
   LIMIT LEAST(GREATEST(coalesce(p_limit,24),1),36)
  OFFSET LEAST(GREATEST(coalesce(p_offset,0),0),2000);
$$;

REVOKE ALL ON FUNCTION public.market_news_feed_v2(text,text,text,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.market_news_feed_v2(text,text,text,integer,integer) TO service_role;
