-- =============================================================
-- Fix #2: Remove email enumeration from check_signup_availability
--
-- Root cause
-- ----------
-- The function was callable by the anon role and queried auth.users
-- to test email uniqueness.  Any unauthenticated request could
-- discover whether a specific email address is registered in the app.
--
-- Fix
-- ---
-- Remove the email uniqueness check entirely.  Email uniqueness is
-- already enforced by Supabase auth.signUp(), which returns a
-- specific error that the client can detect and display.  The p_email
-- parameter is kept in the function signature for backward
-- compatibility with existing callers, but its value is ignored.
--
-- Phone and username availability checks remain callable by anon
-- because they are necessary for the signup UX (the user has no
-- account yet) and the risk profile is lower than email enumeration:
-- phone numbers and usernames are not re-used credentials across
-- services the way email addresses are.
--
-- Client-side impact
-- ------------------
-- Callers that previously received 'EMAIL_TAKEN' from this function
-- will now receive null.  They should surface the "email already in
-- use" message from the auth.signUp() error response instead.
-- =============================================================

create or replace function public.check_signup_availability(
  p_phone    text,
  p_username text default null,
  p_email    text default null   -- retained for backward compat; no longer checked
)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Phone uniqueness
  if p_phone is not null and p_phone <> '' then
    if exists (
      select 1 from public.profiles where phone = p_phone
    ) then
      return 'PHONE_TAKEN';
    end if;
  end if;

  -- Username uniqueness (case-insensitive)
  if p_username is not null and p_username <> '' then
    if exists (
      select 1 from public.profiles
       where lower(username) = lower(p_username)
         and username is not null and username <> ''
    ) then
      return 'USERNAME_TAKEN';
    end if;
  end if;

  -- Email check intentionally removed.
  -- Previously: queried auth.users where lower(email) = lower(p_email)
  -- This let any unauthenticated caller enumerate every registered email.
  -- Duplicate email is now caught only by auth.signUp(), which the client
  -- should handle and display as "this email is already in use."

  return null;
end;
$$;

-- Grant unchanged: still callable by anon and authenticated.
grant execute on function public.check_signup_availability(text, text, text)
  to anon, authenticated;
