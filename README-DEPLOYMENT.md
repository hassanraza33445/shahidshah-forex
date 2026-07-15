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
