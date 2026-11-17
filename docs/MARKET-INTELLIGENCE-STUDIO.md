# S M Shahid Shah — Global Market Intelligence & Private AI Content Studio

**Implementation status:** New website pages and integration are on feature branch until approved merge. The backend functions, news cron and tables were deployed to the existing S M SHAHID SHAH Supabase project. A successful GitHub build check does not by itself prove production/browser behavior.

## New public route
- `/market-intelligence/`: source-linked Gold, Forex, Bitcoin, central-bank and economic headlines; category/priority filters, search, recent articles, refresh and editor handoff.
- Feed implementation: `supabase/functions/market-intelligence-api/index.ts`.
- Background fetch is scheduled every three minutes through pg_cron + pg_net. Finished refreshes can reclaim the lock on the next scheduled run after at least two minutes; a four-minute lease remains a crash watchdog. Source settings, ingest logs and dedupe hashes live in Supabase. Jobs use approved Google News and official feeds rather than private premium feeds.
- Editorial HOT means potentially important, not verified price movement.

## New private route
- `/content-studio/`: existing Supabase login, admin-granted roles, topic/news script generation, editor, saved private projects, versions, review, approval, manual published status, content planner, device TTS, microphone recorder, private upload, transcripts, TXT and SRT exports.
- Edge backends: `shahid-content-ai`, `shahid-studio-access`, `shahid-studio-transcribe`.
- Roles: viewer, creator, editor, approver and studio admin, enforced by database RLS plus server-side identity checks. Website `profiles.is_admin` accounts also have system administrative permissions.
- Admin access changes and notification requests are server-mediated; email submission result is returned separately from permission change.

## Supabase Edge Function Secrets (configure in target project)
- Already used for server database authentication: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (or supported `SUPABASE_SECRET_KEYS`).
- AI scripts: `GEMINI_API_KEY` (preferred) **or** `GROQ_API_KEY` (fallback). **No model works until a valid key is configured.** Never copy PipSePaisa keys.
- Groq speech-to-text: `GROQ_API_KEY`.
- Access notifications: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`. Optional `SMTP_FROM`, if sender is authorized by SMTP provider.
- Frontend key `sb_publishable_HnYmHQbt42OfjmRk09OfoQ_fq5TPYpb` is a public client key, **not** an admin secret.

## Existing project constraints
- Keep original `index.html`, `webinar-admin.html`, `admin-panel.html` and data flows. No new separate auth accounts.
- The historic AI prompt routes now use small redirect pages to `learning-hub.html#<section>`. The original URLs continue to resolve via these static pages or provider-specific rewrites.
- `expo.html` redirects to `/expo/`. `webinar-admin/index.html` redirects to `/webinar-admin.html`. Canonical pages are kept.
- `_redirects` and `vercel.json` include slashless route aliases for the new pages.

## Manual acceptance checks still required
1. Confirm actual hosting provider and successful deployment of GitHub `main`.
2. Open `/market-intelligence/`, verify fetched items, filter and original publisher links on Android, iPhone and desktop.
3. Test a website administrator login to `/content-studio/`; confirm creator grant/revoke and that a revoked account is denied.
4. Configure an AI provider key; generate and save a script using a verified market headline.
5. Save and restore a previous version, submit for review, approve, mark published and plan a date.
6. Configure SMTP; send a real test access email, inspect delivery result/logs.
7. Record a voice clip; upload to private bucket; confirm another account cannot access it.
8. Configure Groq; transcribe clip and export TXT/SRT.
9. Re-run Supabase security/performance advisors, address existing unrelated warnings and verify no unexpected regressions.
10. Verify copy, share, footer, navigation, mobile touch targets, runtime console and network failure states.

**Not included as an enabled live feature:** automatic social posting, fully autonomous fact-checking, guaranteed notification delivery or push alerts requiring external OneSignal setup.

## Local CI checks
`node scripts/check-repo.mjs`
`node scripts/check-site-scripts.mjs`

These check static routes and inline JS syntax; they are not a substitute for browser/E2E tests.


## Market Intelligence V3 rollout — 17 November 2026
- Live database source registry expanded from 15 to 28 enabled feeds: ten new targeted Google News RSS topic searches and three directly published official feeds (ECB press, EIA Today in Energy, EIA press).
- The live `market-intelligence-api` Edge Function was updated to version 6. The deployed code (including its Gold/Forex balanced latest-first logic) was synchronized into the repo so future deploys do not accidentally revert it.
- An administrator-only `?mode=health` source-health API reports source count, errors, retry status and latency; unauthenticated access returned HTTP 403 in the smoke test.
- An empty-but-valid RSS search is treated as a successful zero-result fetch, not a failed source.
- The three-minute cron lock policy was repaired with the idempotent SQL migration `market-intelligence-v3-refresh-lock-20261117.sql`.
- Verified successful 200 responses for `?mode=stats`, `?mode=feed&focus=gold-forex&limit=40` and `?mode=feed&category=Gold&heat=hot&limit=10`. EIA Today in Energy delivered actual articles; the EIA press feed fetched successfully but had no new qualifying stories at the check.
- GitHub PR #36 passed repository and Deno checks and merged to main. **No desktop or mobile HTML/CSS was changed by this rollout.**
- Remaining advanced specification work: directly licensed publisher feed evaluation; multi-stage cross-publisher near-duplicate similarity; keyword watchlists and saved articles; optional notification scheduling refinements; additional economic reminder rules; licensed market-candle integration; full admin control UI; end-to-end mobile/browser validation.


## Phase 2 — Editorial headline quality and publisher discovery (17 November 2026)
- New code lives in `supabase/functions/market-intelligence-api/news-quality.ts`, tested by `news-quality.test.ts`.
- Source discovery adds nine enabled, publisher-filtered **Google News RSS** searches for Reuters (Gold / Forex), FXStreet, ForexLive, Bloomberg, CNBC, Investing.com, Financial Times and Forex Factory. FinancialJuice and Newsquawk queries are registered but disabled pending validation. They are *not* direct/premium publisher subscriptions.
- Headline classification now separates speculative forecasts/previews from major reported economic/policy outcomes. HOT represents potential editorial market relevance, not fact-checking or measured price impact.
- The V3 feed performs conservative, source-independent near-duplicate suppression with category, publication-time, numeric-value and opposing-direction guards. Underlying articles, original URLs, and historic cluster IDs are never deleted or rewritten by this feature; notifications still use their own independent processing.
- Existing strict DB deduplication remains in place, as does the homepage's newest-first Gold/Forex feed. Initial quality changes apply to newly ingested articles; historic editorial labels are not automatically overwritten.
- The Edge Function bundle must include **both** `index.ts` and `news-quality.ts`; deploying the first file alone will break imports.
- Tests: `deno check supabase/functions/market-intelligence-api/index.ts` and `deno test supabase/functions/market-intelligence-api/news-quality.test.ts`.
- Live smoke checks: stats 200, balanced latest-first feed 200, Gold HOT filter 200, unauthenticated admin-health 403, background warm trigger 202. Confirm individual new source ingestion results separately before declaring every source operational.
- No changes to desktop/mobile HTML, CSS, auth, stored scripts, user preferences, notification keys, or landing page in this phase.
