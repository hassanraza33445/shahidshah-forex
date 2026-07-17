# S M Shahid Shah — Webinar Website

This package temporarily replaces the current Forex Hub landing page while keeping the old project safe.

## Included files

- `index.html` — public premium webinar landing page
- `webinar-admin.html` — secure Supabase admin dashboard
- `supabase-webinar-setup.sql` — complete database tables, functions, RLS and seed data

## Existing Supabase project

The files are already configured for the existing project:

- Project URL: `https://qggtdwixwafcmorepkks.supabase.co`
- Frontend publishable key: already inserted in both HTML files

Do **not** create a new Supabase project unless you intentionally want a separate database.

## Installation steps

### 1. Back up the old landing page

In the GitHub repository:

1. Rename the current `index.html` to `index-old.html`.
2. Keep the old `admin-panel.html`, PWA icons, manifest and all other files unchanged.
3. Upload the new `index.html` and `webinar-admin.html`.

The new `index.html` removes the old service worker registration and clears the previous PWA cache, preventing the old page from continuing to appear.

### 2. Set up Supabase

1. Open Supabase Dashboard.
2. Open the existing S M Shahid Shah project.
3. Go to **SQL Editor**.
4. Create a new query.
5. Paste the complete content of `supabase-webinar-setup.sql`.
6. Click **Run**.

The SQL creates:

- `webinar_settings`
- `webinar_videos`
- `webinar_review_items`
- `webinar_registrations`
- `webinar_reviews`
- Secure registration and review RPC functions
- Row Level Security policies
- Initial YouTube videos and review samples

### 3. Give your account admin permission

Use an existing Supabase Auth user. Replace the email and run:

```sql
update public.profiles
set is_admin = true
where email = 'YOUR-ADMIN-EMAIL@example.com';
```

The admin panel uses Supabase email/password login. There is no insecure password stored inside the HTML.

### 4. Open the webinar admin

Open:

```text
https://www.smshahidshah.com/webinar-admin.html
```

Sign in with the admin account. From the dashboard you can manage:

- Webinar heading and description
- Mentor name and bio
- Session date/time in Pakistan time
- Review unlock date/time in Pakistan time
- Zoom meeting link
- WhatsApp, YouTube, Facebook and Instagram links
- Registration open/closed status
- YouTube video cards and descriptions
- Long review content points
- Registration records
- Participant review results and clarity scores
- CSV exports

## Participant flow

1. The user reserves a seat using name, email and WhatsApp number.
2. The registered user immediately receives the Zoom access area.
3. After the review unlock time, the review email form appears.
4. The user enters the same registered email.
5. No OTP is required.
6. Registered email found: review content opens.
7. Unregistered email: access is refused.
8. The participant responds to every point:
   - Yes, I Understood
   - I Am Confused
   - Not Clear Yet
9. The final clarity score and visual breakdown are shown.
10. One registered email can submit only one review.

## Default schedule

- Session: **18 July 2026, 8:00 PM Pakistan Time**
- Review unlock: **18 July 2026, 10:00 PM Pakistan Time**

Both can be changed from the admin panel.

## Zoom link

The SQL contains a placeholder Zoom URL. Open **Event Settings** in the admin and replace it with the real Zoom meeting link before publishing.

The Zoom link is not included in the public configuration response. It is returned only when a registered email is entered.

## Restoring the old website later

1. Rename the webinar `index.html` to `webinar-index.html` or remove it.
2. Rename `index-old.html` back to `index.html`.
3. The old Forex Hub and old admin panel will work again.

## Important security notes

- Never put a Supabase `service_role` key inside HTML.
- The publishable/anon key in the files is intended for frontend use.
- Security is enforced through database RLS and RPC functions.
- The email access system intentionally has no OTP, as requested. Anyone who knows a registered email can access that participant's webinar link/review gate.


## July 2026 UI Update
- Dark theme is the default; light theme is available from the theme toggle.
- The supplied S M Shahid Shah portrait is used for the profile image and app icons.
- Registration and review email inputs now use matching premium theme styles.
- Session timing has a redesigned date tile and countdown.
- Registered users can view and copy the Zoom link.
- Review cards, social icons and page animations have been upgraded.

## Existing Review Result Upgrade

After uploading the latest `index.html`, run `supabase-review-result-upgrade.sql` once in **Supabase Dashboard → SQL Editor**. This enables an already-submitted participant to enter the same registered email and reopen their saved score/result instead of seeing an “already submitted” error.

The latest page also includes stronger premium motion: scroll reveals, hero shimmer, floating event card, animated counters, selected-answer feedback, social icon motion, and result chart animation. Layout dimensions are unchanged.

## Current Landing Page Flow

1. Hero and live-session countdown
2. Social media community cards
3. Featured YouTube videos
4. One centered registration form
5. Registration thank-you panel with WhatsApp channel and support contacts
6. Post-session review and saved result display

**Support contacts shown on the page:**
- +60 11 2050 6427
- +60 11-5695 8905

> The page stores registrations in Supabase. Automatic Zoom-link delivery by email or WhatsApp requires a separate email/WhatsApp automation service or Supabase Edge Function.


## Support Contacts
- Ms. Maryam Javed — +60 11 2050 6427
- Ms. Malaika Shahid — +60 11-5695 8905


## Website Visitor Analytics

The public `index.html` now records anonymous page visits in Supabase. The admin Dashboard shows total visits, approximate unique visitors, today’s visits, last 7 days, device types and top traffic sources.

For an existing database, run `supabase-visitor-analytics-upgrade.sql` once in Supabase SQL Editor. A new installation can use the updated `supabase-webinar-setup.sql`, which already includes the visitor analytics setup.

Unique visitors are approximate and use a browser-generated ID stored in localStorage. Clearing browser storage or visiting from another device creates a new visitor ID. No email, WhatsApp number, precise location or IP address is recorded by this visitor analytics feature.

## Visitor Analytics Tab

The admin panel now includes a separate **Visitor Analytics** tab with:

- Total, unique, today, and last 7 days visits
- Mobile, desktop, and tablet breakdown
- Top traffic sources
- Latest 100 anonymous visit records
- Live updates through Supabase Realtime
- Automatic 30-second refresh fallback if Realtime is unavailable

For an existing installation, run `supabase-visitor-realtime-upgrade.sql` once in Supabase SQL Editor, then upload the updated `webinar-admin.html`.


## Detailed Engagement Analytics Upgrade

Run `supabase-engagement-analytics-upgrade.sql` once in Supabase SQL Editor, then upload the latest `index.html` and `webinar-admin.html`.

The new **Engagement Details** admin tab records in real time:

- Social-media, YouTube, external-link, navigation and button clicks
- The exact clicked label and destination URL
- Section views across Hero, Community, Videos, Registration and Review
- Scroll milestones at 25%, 50%, 75%, 90% and 100%
- Registration form start and successful seat reservation
- Review access and review submission
- Theme changes and visitor device type

Visitors remain anonymous until they reserve a seat or verify their registered email. After identification, earlier events from the same browser visitor ID are linked to their name/email. Passwords, entered form values, IP addresses and precise locations are not stored.


## Social Media Prompt Builder (latest)
1. Run `supabase-prompt-builder-upgrade.sql` once in **Supabase Dashboard → SQL Editor**.
2. Upload the updated `learning-hub.html`, `webinar-admin.html`, and complete `assets` folder.
3. Open the existing `webinar-admin.html` and select **Learning Hub** to manage all six prompt builders.
4. Keep `{{DETAILS}}` inside every master prompt; this is where the visitor's answers are inserted.

The public page contains built-in fallback templates, so it remains usable if the new CMS table is temporarily unavailable. The migration enables admin editing of titles, descriptions, questions, master prompts, publishing status, order and disclaimers.

This additive module does not modify Zoom, SMTP email, webinar registration, reviews or analytics. There is no separate Learning Hub admin login or admin file.

## AI Downloads and Footer Update

1. Run the latest `supabase-prompt-builder-upgrade.sql` in **Supabase Dashboard → SQL Editor**. It safely adds the `download_resources` table and does not replace the existing webinar tables.
2. Upload `learning-hub.html`, `webinar-admin.html`, `index.html`, and the complete `assets` folder.
3. In the existing admin panel, open **Learning Hub → AI Downloads**.
4. Add up to three cards. For each card the admin can set the title, short caption, upload a thumbnail image, upload an XLSX/XLS/CSV file, choose display order, and set published status. No external file link is required.

The same SQL migration creates the public `download-assets` Storage bucket and admin-only upload policies. Run the latest migration before testing file uploads.

Visitor Analytics includes Last Hour, Today, Last 7 Days, and All Recent traffic filters.

The public **AI Downloads** tab displays the supplied 1300×500 light or dark banner, followed by the three responsive resource cards. A complete responsive footer is included on both the landing page and AI Scripts page.

All prompt-builder example text is trading/forex focused. The generated instructions tell the selected AI tool to produce the requested final script, banner, article, analysis, content plan, or indicator work directly instead of returning another prompt.
