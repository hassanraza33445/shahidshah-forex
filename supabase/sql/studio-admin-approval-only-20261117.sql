-- S M Shahid Shah — owner-approved AI Creator Studio only.
-- Existing automatic grants cannot be distinguished from manual grants by provenance:
-- audit table has no "granted" records. Non-admin grants must be re-approved.
-- Website admins remain authorized via profiles.is_admin.
DROP TRIGGER IF EXISTS on_auth_user_free_studio_access ON auth.users;
REVOKE ALL ON FUNCTION app_private.grant_free_creator_on_signup() FROM PUBLIC, anon, authenticated;

ALTER TABLE public.content_access
  ADD COLUMN IF NOT EXISTS granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Revoke all previous non-admin free auto grants; retain the row for audit/history.
UPDATE public.content_access AS access
SET enabled=false
WHERE enabled=true
  AND NOT EXISTS (
    SELECT 1 FROM public.profiles AS owner
    WHERE owner.id=access.user_id AND owner.is_admin=true
  );

-- No browser session may grant their own access. The existing
-- shahid-studio-access Edge Function verifies profiles.is_admin and writes
-- with a server-side service role. All signed-in users may only read
-- their own access row; admins may view the directory by existing RLS.
REVOKE ALL ON public.content_access FROM anon;
REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public.content_access FROM authenticated;
GRANT SELECT ON public.content_access TO authenticated;
ALTER TABLE public.content_access ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.content_access IS
 'Admin-approved Studio access only: no automatic signup grants. Manage through the server-verified shahid-studio-access Edge Function.';
