# S M Shahid Shah — Global Market Intelligence & Private AI Content Studio

**Implementation status:** New website pages and integration are on feature branch until approved merge. The backend functions, news cron and tables were deployed to the existing S M SHAHID SHAH Supabase project. A successful GitHub build check does not by itself prove production/browser behavior.

## New public route
- `/market-intelligence/`: source-linked Gold, Forex, Bitcoin, central-bank and economic headlines; category/priority filters, search, recent articles, refresh and editor handoff.
- Feed implementation: `supabase/functions/market-intelligence-api/index.ts`.
- Background fetch is scheduled every five minutes through pg_cron + pg_net. Source settings, ingest logs and dedupe hashes live in Supabase. Jobs use approved Google News and official feeds rather than private premium feeds.
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
