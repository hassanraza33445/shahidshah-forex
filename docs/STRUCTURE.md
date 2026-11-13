# Repository Structure — S M SHAHID SHAH

This is a static website repository. Do **not** move or delete public page entrypoints unless production hosting and all URL rewrites are proven to work.

## Active web entrypoints (remain unchanged)
- `index.html` — current homepage / webinar landing page
- `admin-panel.html` — earlier administration interface (retain until access/routes are verified)
- `webinar-admin.html` and `webinar-admin/index.html` — existing webinar admin URLs
- `learning-hub.html` — main AI/social content tools implementation
- `ai-*/index.html` and `downloads/index.html` — intentionally kept static route compatibility copies until hosting rewrite validation
- `about/index.html`, `course/index.html`, `community/index.html`, `videos/index.html`, `social/index.html`, `expo/index.html` — active public pages
- `expo.html` — legacy direct URL retained
- `social.html` — small redirect shim to `/social/`
- `sw.js`, `manifest.json`, `CNAME`, `_redirects`, `_headers`, `vercel.json` — deployment / PWA / routing assets

## Organized supporting files
- `docs/history/changelogs/` — previous release changelogs
- `docs/history/verification/` — historical verification notes
- `supabase/sql/` — historical Supabase setup and upgrade scripts; consult `README-DEPLOYMENT.md` before applying any SQL
- `supabase/functions/` — committed server-side Edge Function code
- `assets/` — current website imagery

## Important rules
1. Keep production HTML entrypoint names and routes stable.
2. Do not delete exact HTML duplicates yet: 8 AI/downloads aliases, 2 Expo routes and 2 webinar-admin routes can serve URLs differently depending on host. Rewrites in `vercel.json` and `_redirects` alone do not establish which host is live.
3. This repository currently has **no centralized HTML build system**. Similar homepage-derived pages can differ in navigation behavior, relative URLs, and page-specific boot logic.
4. Git tracks this entire history. Moving changelogs or SQL does not delete prior commit history.
5. Never commit service-role secrets, Gemini/Groq API keys, SMTP passwords or private media.
6. Run `node scripts/check-repo.mjs` after every repository cleanup.
7. Separate new News Hub / Content Studio development branches from the production main branch until verified and reviewed.

## Deploy safety checklist
- Verify `index.html`, `/about/`, `/course/`, `/community/`, `/videos/`, `/ai-tools/`, `/expo/`, `/social/` and admin routes in staging.
- Confirm link targets, image paths, correct authentication and mobile/tablet responsive behavior.
- Verify no rewrite depends on moved paths.
- Treat route aliases as intentional until hosting confirmation.

Repository organization dated 13 November 2026. No runtime HTML, CSS or JS changes are made by this cleanup.
