-- One-time safe launch backfill: REAL HOT articles from last 24 hours only.
-- Explicitly labels unverified sources. No fan-out or external delivery; does not alter news articles.
WITH candidates AS(
 SELECT a.id,a.cluster_id,a.title,a.publisher,a.original_url,a.category,
  a.verification_status,a.first_seen_at,
  row_number() OVER(PARTITION BY coalesce(a.cluster_id,a.id)
   ORDER BY a.first_seen_at DESC,a.id DESC) AS pos
 FROM public.news_articles a
 WHERE a.is_visible=true AND a.priority='HOT'
  AND a.first_seen_at >= now()-interval '24 hours'
  AND a.first_seen_at <= now()
  AND coalesce(a.published_at,a.first_seen_at) >= now()-interval '24 hours'
  AND a.original_url LIKE 'https://%'
)
INSERT INTO public.market_notification_events(
 dedupe_key,kind,title,body,topic,impact,trust_status,
 target_url,source_article_id,created_at,expires_at
)
SELECT 'hot-news:'||coalesce(c.cluster_id,c.id)::text,
 'breaking_news',left(c.title,240),
 left('HOT editorial headline from '||c.publisher||'. Source status: '||
  CASE WHEN c.verification_status='verified'
   THEN 'verified' ELSE 'unverified — verify the original report' END||'.',600),
 c.category,'HOT',
 CASE WHEN c.verification_status='verified' THEN 'verified' ELSE 'unverified' END,
 c.original_url,c.id,c.first_seen_at,c.first_seen_at+interval '14 days'
FROM candidates c
WHERE c.pos=1
 AND c.category IN ('Gold','Forex','Crypto','Central Banks','Economic Data','Energy','Geopolitics')
ON CONFLICT(dedupe_key) DO NOTHING;
