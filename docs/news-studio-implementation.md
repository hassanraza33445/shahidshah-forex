# S M SHAHID SHAH — World News Hub + AI Content Studio

## Scope
Implement a production-quality financial news aggregation service and private AI script creation studio, following the PipSePaisa architecture as a reference without copying data, secrets or credentials.

## Completed (13 November 2026)
Supabase migration `shahid_news_studio_foundation_20261113` applied to project `qggtdwixwafcmorepkks`.

Created 13 tables:
- news_sources
- news_story_clusters
- news_articles
- news_ingestion_runs
- content_access
- content_projects
- content_project_versions
- content_comments
- content_schedules
- content_user_preferences
- content_recordings
- news_alerts
- content_audit_logs

All new tables have RLS enabled with initial restrictive policies. `has_content_role(text[])` checks the target project's access table and existing admin role. No access accounts were auto-granted. No RSS sources were activated. No user data from PipSePaisa was copied.

## Implementation queue (not yet complete)
1. Audit production hosting and decide ingestion worker location; never fetch hundreds of feeds on each page view.
2. Build safe RSS/Atom ingestion with licensed feeds, source-health logs, deduplication, timestamps and a 3–5 minute scheduler.
3. Add a paginated read-only news API and responsive news frontend with cache/stale handling.
4. Implement server-side authenticated AI generation and provider secrets in the target environment.
5. Build private Studio UI, script editor, versions, reviews, voice, recording, transcription and exports.
6. Implement secure admin access grants and branded email notifications with actual delivery-status reporting.
7. Add optional push alerts, per-user consent, dedupe and quiet hours.
8. Complete ownership/role tests, end-to-end browser/mobile checks, performance benchmarks and deployment.

## Security review required before public rollout
- Verify creator/editor/approver workflow policies for status transitions and sharing. Existing foundation only allows owner draft/review updates and admin full control.
- Do not use client-side localStorage as authorization.
- Add per-user and per-IP AI/ingestion rate limits.
- Restrict upload bucket access and MIME/size on the server.
- Confirm article attribution, publisher license terms and permitted use of images.
- Review public repository visibility and historical secrets.
- Confirm storage and scheduler billing before enabling background ingestion.

## Definition of done
Actual feed articles are ingested and deduplicated in the target database; the site serves cached news; authorized creators can generate, edit, save and review scripts; access removal is enforced; desktop/mobile workflows pass tests; production deployment is verified. None of these are claimed complete by the database migration alone.
