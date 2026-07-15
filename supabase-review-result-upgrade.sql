-- ============================================================
-- Webinar upgrade: show an existing participant's saved review result
-- Run this ONCE in Supabase Dashboard > SQL Editor.
-- Safe to run again because CREATE OR REPLACE is used.
-- ============================================================

create or replace function public.get_webinar_review_result(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_registration public.webinar_registrations%rowtype;
  v_review public.webinar_reviews%rowtype;
begin
  select * into v_registration
  from public.webinar_registrations
  where email_normalized = lower(btrim(coalesce(p_email, '')));

  if not found then
    return jsonb_build_object(
      'success', false,
      'code', 'not_registered',
      'message', 'No registration was found with this email address.'
    );
  end if;

  select * into v_review
  from public.webinar_reviews
  where registration_id = v_registration.id;

  if not found then
    return jsonb_build_object(
      'success', false,
      'code', 'not_submitted',
      'message', 'No submitted review result was found for this email address.'
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'name', v_review.name,
    'email', v_review.email,
    'understood', v_review.understood_count,
    'confused', v_review.confused_count,
    'not_clear', v_review.not_clear_count,
    'score', v_review.clarity_score,
    'submitted_at', v_review.submitted_at
  );
end;
$$;

revoke all on function public.get_webinar_review_result(text) from public;
grant execute on function public.get_webinar_review_result(text) to anon, authenticated;
