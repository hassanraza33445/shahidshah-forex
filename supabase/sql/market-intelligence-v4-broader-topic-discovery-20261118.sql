-- Expand independent real-market RSS discovery with broad topic searches from the public
-- headline categories already used by both projects. Google News is only a discovery
-- index; original publisher attribution, source links, verification flags, and
-- existing clustering/deduplication remain unchanged. No fabricated headlines.
-- Safe additive UPSERT; current feed configuration and opt-in settings are untouched.
INSERT INTO public.news_sources
  (name, feed_url, category, priority_weight, polling_minutes, enabled)
VALUES
  ('Gold Breaking Headlines', 'https://news.google.com/rss/search?q=gold%20OR%20XAUUSD%20OR%20bullion%20OR%20silver%20when%3A1d&hl=en-US&gl=US&ceid=US%3Aen', 'Gold', 99, 3, true),
  ('Forex Breaking Headlines', 'https://news.google.com/rss/search?q=forex%20OR%20currencies%20OR%20DXY%20OR%20EURUSD%20OR%20GBPUSD%20when%3A1d&hl=en-US&gl=US&ceid=US%3Aen', 'Forex', 99, 3, true),
  ('Yen BOJ Intervention', 'https://news.google.com/rss/search?q=USDJPY%20OR%20yen%20intervention%20OR%20BOJ%20OR%20Japanese%20currency%20when%3A1d&hl=en-US&gl=US&ceid=US%3Aen', 'Forex', 98, 5, true),
  ('EUR GBP Major Pairs', 'https://news.google.com/rss/search?q=EURUSD%20OR%20GBPUSD%20OR%20EURJPY%20OR%20GBPJPY%20when%3A1d&hl=en-US&gl=US&ceid=US%3Aen', 'Forex', 95, 5, true),
  ('AUD NZD CAD CHF Pair Updates', 'https://news.google.com/rss/search?q=AUDUSD%20OR%20NZDUSD%20OR%20USDCAD%20OR%20USDCHF%20when%3A1d&hl=en-US&gl=US&ceid=US%3Aen', 'Forex', 91, 10, true),
  ('US Inflation and Jobs Reports', 'https://news.google.com/rss/search?q=CPI%20OR%20PPI%20OR%20nonfarm%20payrolls%20OR%20unemployment%20OR%20PCE%20when%3A1d&hl=en-US&gl=US&ceid=US%3Aen', 'Economic Data', 99, 5, true),
  ('US Growth and PMI Reports', 'https://news.google.com/rss/search?q=GDP%20OR%20jobless%20claims%20OR%20retail%20sales%20OR%20JOLTS%20OR%20PMI%20when%3A1d&hl=en-US&gl=US&ceid=US%3Aen', 'Economic Data', 96, 5, true),
  ('Fed Rate and FOMC Reports', 'https://news.google.com/rss/search?q=FOMC%20OR%20Powell%20OR%20Federal%20Reserve%20OR%20rate%20hike%20when%3A1d&hl=en-US&gl=US&ceid=US%3Aen', 'Central Banks', 99, 5, true),
  ('Global Central Bank Decisions', 'https://news.google.com/rss/search?q=ECB%20OR%20BOE%20OR%20BOJ%20OR%20RBA%20OR%20RBNZ%20interest%20rates%20when%3A1d&hl=en-US&gl=US&ceid=US%3Aen', 'Central Banks', 94, 10, true),
  ('World Conflict and Ceasefire', 'https://news.google.com/rss/search?q=Iran%20OR%20Israel%20OR%20Ukraine%20OR%20Russia%20OR%20ceasefire%20when%3A1d&hl=en-US&gl=US&ceid=US%3Aen', 'Geopolitics', 98, 5, true),
  ('US Tariffs and White House', 'https://news.google.com/rss/search?q=Trump%20OR%20White%20House%20OR%20sanctions%20OR%20tariffs%20when%3A1d&hl=en-US&gl=US&ceid=US%3Aen', 'Geopolitics', 98, 5, true),
  ('Oil Crude and OPEC Coverage', 'https://news.google.com/rss/search?q=oil%20OR%20crude%20OR%20OPEC%20OR%20Brent%20OR%20WTI%20when%3A1d&hl=en-US&gl=US&ceid=US%3Aen', 'Energy', 93, 10, true),
  ('Gold ETF and Bullion Demand', 'https://news.google.com/rss/search?q=gold%20ETF%20OR%20bullion%20demand%20OR%20central%20bank%20gold%20buying%20when%3A1d&hl=en-US&gl=US&ceid=US%3Aen', 'Gold', 93, 10, true),
  ('World Gold Council Headlines', 'https://news.google.com/rss/search?q=site%3Agold.org%20gold%20OR%20World%20Gold%20Council%20when%3A1d&hl=en-US&gl=US&ceid=US%3Aen', 'Gold', 93, 10, true),
  ('Reuters Currency Discovery', 'https://news.google.com/rss/search?q=site%3Areuters.com%20forex%20OR%20currencies%20OR%20dollar%20when%3A1d&hl=en-US&gl=US&ceid=US%3Aen', 'Forex', 96, 10, true),
  ('FXStreet Major Pairs Discovery', 'https://news.google.com/rss/search?q=site%3Afxstreet.com%20EURUSD%20OR%20GBPUSD%20OR%20USDJPY%20when%3A1d&hl=en-US&gl=US&ceid=US%3Aen', 'Forex', 95, 5, true),
  ('CNBC Markets and Inflation', 'https://news.google.com/rss/search?q=site%3Acnbc.com%20Wall%20Street%20OR%20Fed%20OR%20inflation%20when%3A1d&hl=en-US&gl=US&ceid=US%3Aen', 'Economic Data', 90, 10, true),
  ('Bitcoin Ethereum ETF News', 'https://news.google.com/rss/search?q=bitcoin%20OR%20BTC%20OR%20ethereum%20OR%20crypto%20ETF%20when%3A1d&hl=en-US&gl=US&ceid=US%3Aen', 'Crypto', 90, 10, true),
  ('EIA Oil Market Discoveries', 'https://news.google.com/rss/search?q=EIA%20crude%20inventories%20OR%20OPEC%20output%20when%3A1d&hl=en-US&gl=US&ceid=US%3Aen', 'Energy', 90, 10, true),
  ('Treasury Yields and Wall Street', 'https://news.google.com/rss/search?q=US%20Treasury%20yields%20OR%20bond%20auction%20OR%20Wall%20Street%20when%3A1d&hl=en-US&gl=US&ceid=US%3Aen', 'Economic Data', 90, 10, true)
ON CONFLICT (feed_url) DO NOTHING;
