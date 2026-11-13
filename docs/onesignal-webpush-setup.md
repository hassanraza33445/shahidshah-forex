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
- `ONESIGNAL_DISPATCH_ENABLED` — keep **false** until scheduler and test device verified.

The public notification API returns only `app_id` when **all three** conditions are fulfilled, and NEVER returns the REST key. The static page loads the OneSignal v16 SDK only after a signed-in user opts in.

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
3. Use one authenticated TEST account and TEST browser to verify opt-in, a verified test economic reminder, quiet-hour suppression, duplicate prevention, server-only sender access, and opt-out across devices. Never send fabricated financial news.
4. Only then set `ONESIGNAL_DISPATCH_ENABLED=true`, redeploy affected Edge Functions if necessary, and run end-to-end tests again.
5. Monitor `market_push_deliveries` for errors and user opt-out; disable dispatch flag to stop deliveries.
6. iOS Safari push may require installing the website to the home screen on a supported iOS release.
