-- Ensure only one pending/reviewing mentorship application per signed-in member.
CREATE UNIQUE INDEX IF NOT EXISTS member_mentorship_one_active
 ON public.member_mentorship_applications(user_id) WHERE status IN ('pending','reviewing');
-- Let authenticated administrators update review status under the existing admin-only RLS policy.
-- Ordinary members have no UPDATE policy; grants alone do not allow modifying their own status.
GRANT UPDATE(status,admin_note,updated_at) ON public.member_mentorship_applications TO authenticated;
