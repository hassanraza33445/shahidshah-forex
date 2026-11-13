-- Signed-in mentorship applications for the premium member dashboard.
-- User can create and view their own requests; only privileged staff can review.
CREATE TABLE IF NOT EXISTS public.member_mentorship_applications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 full_name text NOT NULL CHECK (char_length(trim(full_name)) BETWEEN 2 AND 100),
 contact_email text NOT NULL CHECK (char_length(trim(contact_email)) BETWEEN 5 AND 254),
 whatsapp text NOT NULL CHECK (char_length(trim(whatsapp)) BETWEEN 6 AND 32),
 interest text NOT NULL CHECK (interest IN ('Forex Trading','Brokerage Business','Market Intelligence','Business Development','Other')),
 goals text NOT NULL CHECK (char_length(trim(goals)) BETWEEN 12 AND 1500),
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','reviewing','approved','rejected')),
 admin_note text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS member_mentorship_user_newest ON public.member_mentorship_applications(user_id,created_at DESC);
ALTER TABLE public.member_mentorship_applications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner can view mentorship applications" ON public.member_mentorship_applications;
CREATE POLICY "Owner can view mentorship applications" ON public.member_mentorship_applications
 FOR SELECT TO authenticated USING(user_id=(select auth.uid()));
DROP POLICY IF EXISTS "Owner can apply for mentorship" ON public.member_mentorship_applications;
CREATE POLICY "Owner can apply for mentorship" ON public.member_mentorship_applications
 FOR INSERT TO authenticated WITH CHECK(user_id=(select auth.uid()) AND status='pending' AND admin_note IS NULL);
DROP POLICY IF EXISTS "Admin can review mentorship applications" ON public.member_mentorship_applications;
CREATE POLICY "Admin can review mentorship applications" ON public.member_mentorship_applications
 FOR ALL TO authenticated
 USING (EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(select auth.uid()) AND p.is_admin=true))
 WITH CHECK(EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(select auth.uid()) AND p.is_admin=true));
REVOKE ALL ON public.member_mentorship_applications FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.member_mentorship_applications TO authenticated;
GRANT SELECT,UPDATE,DELETE ON public.member_mentorship_applications TO service_role;
-- Elevated admins may review via existing authenticated grants + owner/admin RLS when permission granted explicitly later.
