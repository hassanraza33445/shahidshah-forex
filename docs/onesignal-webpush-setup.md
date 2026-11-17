# OneSignal Web Push — S M Shahid Shah
> This integration is intentionally **disabled until authenticated end-to-end tests and OneSignal credentials are configured**.

## Setup in OneSignal
1. Create a OneSignal Web Push application using **Custom Code**.
2. Select exactly **https://www.smshahidshah.com** as Site URL (web push is origin-scoped). The non-www site remains functional for all other features; redirect users to www for subscriptions.
3. Configure service worker directory **/onesignal/**, file **OneSignalSDKWorker.js**, scope **/onesignal/**. The existing root `/sw.js` is unaffected.
4. Disable auto prompt, welcome push, automatic notification sends and any journeys until tested. Users must click **Enable Browser Push** manually.

## Secrets (never commit or paste keys into client code)
In Supabase Dashboard > Project Settings > Edge Functions > Secrets, add:
- `ONESIGNAL_APP_ID` — public OneSignal application UUID.
- `ONESIGNAL_REST_API_KEY` — secret OneSignal App REST key, server only.
- `ONESIGNAL_SUBSCRIPTIONS_ENABLED` — initially **false**; set **true** only to test voluntary browser subscription after keys are configured. This does **not** send any push messages.
- `ONESIGNAL_DISPATCH_ENABLED` — always keep **false** until a verified test subscription, worker, private scheduler and delivery checks pass.

The public notification API returns only `app_id` once App ID, REST key and `ONESIGNAL_SUBSCRIPTIONS_ENABLED=true` are configured. Real delivery additionally requires the separate `ONESIGNAL_DISPATCH_ENABLED=true` switch and private scheduler; the API NEVER returns the REST key. The static page loads the OneSignal v16 SDK only after a signed-in user opts in.

## Delivery model
- Supabase authenticated user explicitly saves preferences, enables browser push and grants native browser permission.
- The browser's OneSignal **subscription ID** (not a spoofable External User ID) is saved on the server with that user's ID.
- Source-verified HOT stories and published official economic reminders only are queued. All unverified HOT news continues to appear *in-app* without external push.
- Quiet hours are evaluated in the user's saved timezone before delivery. Time-sensitive alerts are suppressed, **never delivered late** after quiet hours.
- OneSignal REST requests target `include_subscription_ids`, use the saved `idempotency_key`, and log accepted request ID. A 200 with an ID means OneSignal accepted the request — not verified device delivery.
- Each account may have at most four registered devices; users can disable all push from Notification Center.
- Send endpoint: `POST /functions/v1/market-push-dispatch` with a server-side **service-role Bearer token**. Public and user Bearer tokens receive 403. Do not expose service-role key to the browser or GitHub.
- There is **no dispatch cron enabled by default**. Enabling OneSignal credentials alone does not cause push sends.

## Go-live checklist
1. Save the two secrets; verify `/onesignal/OneSignalSDKWorker.js` returns HTTP 200 and JavaScript content type, not HTML.
2. Configure a private server-only scheduler (for example Supabase pg_cron + Vault, never plaintext credentials inside cron.job) to call the dispatcher at most every 5 minutes.
3. Set `ONESIGNAL_SUBSCRIPTIONS_ENABLED=true` but keep dispatch **false**. Use one authenticated TEST account and TEST browser to verify opt-in, a verified test economic reminder, quiet-hour suppression, duplicate prevention, server-only sender access, and opt-out across devices. Never send fabricated financial news.
4. Only then set `ONESIGNAL_DISPATCH_ENABLED=true`, redeploy affected Edge Functions if necessary, and run end-to-end tests again.
5. Monitor `market_push_deliveries` for errors and user opt-out; disable dispatch flag to stop deliveries.
6. iOS Safari push may require installing the website to the home screen on a supported iOS release.


## Phase 4 — Keyword HOT notification workflow (17 November 2026)
- `market_notification_preferences.keyword_alerts_enabled` is an **explicit opt-in**, default `false`.
- The existing five-minute in-app worker checks enabled, category-compatible watchwords using literal case-insensitive substring matching against article titles. HOT news must already have a unique, real, source-linked notification event; unique `(user_id,notice_id)` prevents duplicate inbox deliveries.
- General breaking-news preferences and separately opted-in keyword alerts can coexist, without sending the same event twice to the same account.
- Browser push stays isolated from this feature: only articles marked **verified** and official economic reminders are eligible. Unverified HOT news may show in-app with its warning but is **never** sent via browser push.
- Both the push queue and Edge Function dispatcher check topic/keyword opt-in, active browser subscription, verified source, quiet hours, expiry and prior idempotency. The corrected push queue includes `source_article_id` in its due CTE.
- The Market Intelligence personal dialog now supports Inbox, Watchlist, keyword HOT toggles, and a manual OneSignal opt-in flow. No auto browser prompts, background OneSignal SDK loading, or activation of the dispatch secret.
- `ONESIGNAL_APP_ID`, `ONESIGNAL_REST_API_KEY`, `ONESIGNAL_SUBSCRIPTIONS_ENABLED`, and `ONESIGNAL_DISPATCH_ENABLED` must be configured and re-tested before any real push is possible. Keep dispatch **false** until a verified consent/test device and independent live deployment are confirmed.
- Database migrations: `market-notification-v4-keyword-optin-20261117.sql` and the production follow-up `market-notification-v4-push-article-fix-20261117.sql`.
- Existing landing-page layout, private account data, historical articles, and AI Studio were not redesigned or reset.
