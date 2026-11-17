-- Financial News Intelligence V3 source registry, 2026-11-17.
-- Additive and idempotent: existing feeds, news, user preferences and layouts stay unchanged.
-- Google News feeds index publisher headlines; they are not licensed publisher APIs.
-- Official EIA feeds are enabled after the approved-host API revision passes smoke tests.
-- IMPORTANT: do not introduce direct premium publisher RSS without validating availability and terms.

INSERT INTO public.news_sources(name, feed_url, category, priority_weight, polling_minutes, enabled)
VALUES
  ('Gold ETF and Central Bank Buying', 'https://news.google.com/rss/search?q=gold%20ETF%20inflows%20outflows%20central%20bank%20gold%20buying%20when%3A1d&hl=en-US&gl=US&ceid=US%3Aen', 'Gold', 95, 5, true),
  ('Gold CFTC COMEX Positioning', 'https://news.google.com/rss/search?q=CFTC%20COT%20COMEX%20gold%20futures%20positioning%20when%3A1d&hl=en-US&gl=US&ceid=US%3Aen', 'Gold', 91, 10, true),
  ('Gold Silver Futures', 'https://news.google.com/rss/search?q=gold%20silver%20XAUUSD%20XAGUSD%20COMEX%20futures%20when%3A1d&hl=en-US&gl=US&ceid=US%3Aen', 'Gold', 89, 5, true),
  ('Forex GBPJPY EURJPY Crosses', 'https://news.google.com/rss/search?q=GBPJPY%20EURJPY%20Japanese%20yen%20forex%20market%20when%3A1d&hl=en-US&gl=US&ceid=US%3Aen', 'Forex', 93, 5, true),
  ('Forex AUD NZD CAD CHF', 'https://news.google.com/rss/search?q=AUDUSD%20NZDUSD%20USDCAD%20USDCHF%20currency%20market%20when%3A1d&hl=en-US&gl=US&ceid=US%3Aen', 'Forex', 92, 5, true),
  ('US PCE GDP PMI JOLTS', 'https://news.google.com/rss/search?q=US%20core%20PCE%20GDP%20JOLTS%20ISM%20PMI%20retail%20sales%20when%3A1d&hl=en-US&gl=US&ceid=US%3Aen', 'Economic Data', 98, 5, true),
  ('ECB Bank of England Decisions', 'https://news.google.com/rss/search?q=European%20Central%20Bank%20Bank%20of%20England%20rate%20decision%20when%3A1d&hl=en-US&gl=US&ceid=US%3Aen', 'Central Banks', 98, 5, true),
  ('US Tariffs Sanctions Trade Policy', 'https://news.google.com/rss/search?q=US%20White%20House%20tariffs%20sanctions%20trade%20policy%20markets%20when%3A1d&hl=en-US&gl=US&ceid=US%3Aen', 'Geopolitics', 92, 10, true),
  ('Ethereum ETFs Crypto Regulation', 'https://news.google.com/rss/search?q=Ethereum%20ETH%20ETF%20SEC%20cryptocurrency%20regulation%20when%3A1d&hl=en-US&gl=US&ceid=US%3Aen', 'Crypto', 88, 5, true),
  ('EIA OPEC Oil Supply', 'https://news.google.com/rss/search?q=EIA%20OPEC%20oil%20supply%20crude%20inventories%20when%3A1d&hl=en-US&gl=US&ceid=US%3Aen', 'Energy', 87, 10, true),
  ('ECB Official Press', 'https://www.ecb.europa.eu/rss/press.html', 'Central Banks', 100, 15, true),
  ('EIA Official Today in Energy', 'https://www.eia.gov/rss/todayinenergy.xml', 'Energy', 100, 15, true),
  ('EIA Official Press Releases', 'https://www.eia.gov/rss/press_rss.xml', 'Energy', 98, 15, true)
ON CONFLICT (feed_url) DO NOTHING;
