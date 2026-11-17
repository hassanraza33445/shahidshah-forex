-- News Intelligence Phase 2: publisher-specific Google News RSS discovery.
-- These are topic-filtered Google News searches, NOT direct publisher APIs or licensed premium feeds.
-- Keep distinct article source attribution; respect publisher terms and link to original reports.
-- FinancialJuice and Newsquawk discovery searches intentionally remain disabled pending validation.
-- Existing sources and news records are not modified; safe and idempotent.
INSERT INTO public.news_sources (name,feed_url,category,priority_weight,polling_minutes,enabled)
VALUES
  ('Reuters Gold Headlines', 'https://news.google.com/rss/search?q=site%3Areuters.com%20gold%20bullion%20when%3A1d&hl=en-US&gl=US&ceid=US%3Aen', 'Gold', 97, 5, true),
  ('Reuters FX Headlines', 'https://news.google.com/rss/search?q=site%3Areuters.com%20currencies%20forex%20dollar%20when%3A1d&hl=en-US&gl=US&ceid=US%3Aen', 'Forex', 97, 5, true),
  ('FXStreet XAUUSD Coverage', 'https://news.google.com/rss/search?q=site%3Afxstreet.com%20XAUUSD%20gold%20when%3A1d&hl=en-US&gl=US&ceid=US%3Aen', 'Gold', 96, 5, true),
  ('ForexLive Currency & Central Banks', 'https://news.google.com/rss/search?q=site%3Aforexlive.com%20forex%20dollar%20Fed%20when%3A1d&hl=en-US&gl=US&ceid=US%3Aen', 'Forex', 96, 5, true),
  ('Bloomberg Central Bank Headlines', 'https://news.google.com/rss/search?q=site%3Abloomberg.com%20federal%20reserve%20rates%20when%3A1d&hl=en-US&gl=US&ceid=US%3Aen', 'Central Banks', 95, 10, true),
  ('CNBC Economic Data Headlines', 'https://news.google.com/rss/search?q=site%3Acnbc.com%20inflation%20jobs%20Fed%20when%3A1d&hl=en-US&gl=US&ceid=US%3Aen', 'Economic Data', 94, 10, true),
  ('Investing.com Gold News', 'https://news.google.com/rss/search?q=site%3Ainvesting.com%20gold%20XAUUSD%20when%3A1d&hl=en-US&gl=US&ceid=US%3Aen', 'Gold', 93, 10, true),
  ('Financial Times Macro Headlines', 'https://news.google.com/rss/search?q=site%3Aft.com%20central%20banks%20rates%20when%3A1d&hl=en-US&gl=US&ceid=US%3Aen', 'Central Banks', 92, 10, true),
  ('Forex Factory FX Headlines', 'https://news.google.com/rss/search?q=site%3Aforexfactory.com%20forex%20economic%20news%20when%3A1d&hl=en-US&gl=US&ceid=US%3Aen', 'Forex', 92, 10, true),
  ('FinancialJuice Market Headlines', 'https://news.google.com/rss/search?q=site%3Afinancialjuice.com%20forex%20Fed%20when%3A1d&hl=en-US&gl=US&ceid=US%3Aen', 'Markets', 90, 10, false),
  ('Newsquawk Market Headlines', 'https://news.google.com/rss/search?q=site%3Anewsquawk.com%20forex%20central%20banks%20when%3A1d&hl=en-US&gl=US&ceid=US%3Aen', 'Markets', 90, 10, false)
ON CONFLICT (feed_url) DO NOTHING;
