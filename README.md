# S M SHAHID SHAH — Website

Official static website repository for **S M SHAHID SHAH**, featuring a professional public profile, webinars, learning resources, social links and administration tools.

**Website:** https://www.smshahidshah.com

## Project navigation

| Location | Purpose |
| --- | --- |
| `index.html` | Current homepage / webinar landing page |
| `about/`, `course/`, `community/`, `videos/` | Public site sections |
| `social/`, `expo/` | Social profiles and Expo registration |
| `learning-hub.html` and `ai-*/` | Trading education and AI content tools |
| `admin-panel.html`, `webinar-admin.html` | Existing admin interfaces |
| `assets/` | Image assets and banners |
| `supabase/functions/` | Edge Function source |
| `supabase/sql/` | Existing SQL setup and migration history |
| `docs/history/` | Historical changelogs and checks |
| `scripts/check-repo.mjs` | Repository structure verification |

**Please read [Repository Structure](docs/STRUCTURE.md)** before moving live HTML routes.

## Connected services

The existing website connects to the dedicated S M SHAHID SHAH Supabase project. The published client key is intended for browser use; private secrets must stay server-side. Existing event registrations and administration rely on that database.

For historic setup instructions, see [Deployment Notes](README-DEPLOYMENT.md).

## Important deployment constraints

This is a static HTML repository with various route-specific `index.html` files and compatibility copies. Do not remove those based only on matching checksums. Production hosting and rewrites must first be verified. `_redirects` and `vercel.json` represent provider-specific routing configurations.

**News & Studio work:** Feature work on separate branches is not automatically live when the backend is deployed. Confirm an approved merge and production rollout separately.

Run `node scripts/check-repo.mjs` for a safe file-layout audit without modifying any content.
