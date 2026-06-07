-- =============================================================
-- Fix #3: Prevent phone-number → real-email leakage in
--         resolve_login_identifier
--
-- Root cause
-- ----------
-- The function is callable by the anon role.  For the phone-number
-- lookup path (steps 1–2 in the original), it resolved the matching
-- user_id from public.profiles and then read that user's email from
-- auth.users.  If the matched account was created with a real email
-- and later had a phone number added in Settings, the function
-- returned the real email to the unauthenticated caller.
--
-- Fix
-- ---
-- After a phone-number match, read the auth email from auth.users as
-- before, but only return it when it is in the synthetic format
-- (ph_<digits>@gotchulatr.internal).  That format encodes only
-- the phone digits the caller already supplied, so returning it
-- leaks nothing new.  Accounts whose auth email is a real address
-- (email signup + phone added later) receive null; those users must
-- log in with their email directly.
--
-- The username lookup path (step 3) is unchanged.  Username-based
-- login exposes the auth email to the caller, but usernames are
-- app-specific identifiers — unlike phone numbers they are not
-- independently guessable from public information.  Fixing the
-- username path would break username-based login for email accounts
-- and is deferred pending an auth architecture review.
--
-- Behaviour summary after this migration
-- ---------------------------------------
--   Phone-only account (synthetic email)   → synthetic email returned ✓
--   Email account + phone added later      → null (use email to log in)
--   Username for phone-only account        → synthetic email returned ✓
--   Username for email account             → real email returned (unchanged)
-- =============================================================

create or replace function public.resolve_login_identifier(identifier text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id     uuid;
  v_auth_email  text;
  v_clean       text    := trim(identifier);
  v_phone_match boolean := false;
begin
  if v_clean = '' or v_clean is null then
    return null;
  end if;

  -- 1. Exact phone match (client normalizes before calling)
  select id into v_user_id
    from public.profiles
   where phone = v_clean
     and phone is not null and phone <> ''
   limit 1;

  if v_user_id is not null then
    v_phone_match := true;
  end if;

  -- 2. Digits-only fallback (handles minor format drift, e.g. "+1 555…" vs "1555…")
  if v_user_id is null then
    select id into v_user_id
      from public.profiles
     where regexp_replace(phone, '[^0-9]', '', 'g')
             = regexp_replace(v_clean, '[^0-9]', '', 'g')
       and phone is not null and phone <> ''
     limit 1;

    if v_user_id is not null then
      v_phone_match := true;
    end if;
  end if;

  -- 3. Username (case-insensitive) — only reached when no phone matched
  if v_user_id is null then
    select id into v_user_id
      from public.profiles
     where lower(username) = lower(v_clean)
       and username is not null and username <> ''
     limit 1;
  end if;

  if v_user_id is null then
    return null;
  end if;

  -- Fetch the Supabase auth email for the resolved user.
  select email into v_auth_email
    from auth.users
   where id = v_user_id;

  -- For phone-based matches: only return synthetic emails.
  -- A synthetic email is ph_<digits>@gotchulatr.internal; it encodes
  -- nothing beyond the phone number the caller already knows.
  -- Returning a real email would let an unauthenticated caller discover
  -- the account email from a phone number alone.
  -- Accounts with a real auth email must log in via email directly.
  if v_phone_match and v_auth_email not like '%@gotchulatr.internal' then
    return null;
  end if;

  return v_auth_email;
end;
$$;

-- Grant unchanged: still callable by anon and authenticated.
grant execute on function public.resolve_login_identifier(text)
  to anon, authenticated;
