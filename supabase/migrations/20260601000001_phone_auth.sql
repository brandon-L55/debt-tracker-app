-- =============================================================
-- Phone-first auth support
--
-- 1. Unique partial index on profiles.phone
-- 2. Unique partial index on profiles.username (case-insensitive)
-- 3. Update handle_new_user to skip synthetic internal emails
-- 4. check_signup_availability RPC (callable by anon)
-- 5. resolve_login_identifier RPC (phone or username → auth email)
-- =============================================================


-- ─── 1. Unique phone ──────────────────────────────────────────
create unique index if not exists profiles_phone_unique_idx
  on public.profiles (phone)
  where phone is not null and phone <> '';


-- ─── 2. Unique username (case-insensitive, when set) ─────────
create unique index if not exists profiles_username_ci_unique_idx
  on public.profiles (lower(username))
  where username is not null and username <> '';


-- ─── 3. handle_new_user: skip synthetic internal emails ──────
-- Synthetic emails (used for phone-only accounts) look like:
--   ph_15551234567@gotchulatr.internal
-- We should NOT store these in profiles.email so that if the
-- user later adds a real email in Settings it is not overwritten.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(new.email));
begin
  if v_email like '%@gotchulatr.internal' then
    -- Phone-only account: create the profile row but leave email null.
    insert into public.profiles (id)
    values (new.id)
    on conflict (id) do nothing;
  else
    insert into public.profiles (id, email)
    values (new.id, v_email)
    on conflict (id) do update
      set email = excluded.email
      where profiles.email is distinct from excluded.email;
  end if;
  return new;
end;
$$;


-- ─── 4. check_signup_availability ────────────────────────────
-- Returns null if all identifiers are available.
-- Returns 'PHONE_TAKEN' | 'USERNAME_TAKEN' | 'EMAIL_TAKEN' if not.
-- Called by the client before auth.signUp so we never create orphan
-- auth users whose profile cannot be saved.
create or replace function public.check_signup_availability(
  p_phone    text,
  p_username text default null,
  p_email    text default null
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
      select 1 from public.profiles
       where phone = p_phone
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

  -- Email uniqueness (checked against auth.users to cover all cases)
  if p_email is not null and p_email <> '' then
    if exists (
      select 1 from auth.users
       where lower(email) = lower(p_email)
    ) then
      return 'EMAIL_TAKEN';
    end if;
  end if;

  return null;
end;
$$;

grant execute on function public.check_signup_availability(text, text, text)
  to anon, authenticated;


-- ─── 5. resolve_login_identifier ─────────────────────────────
-- Given a phone number or username, returns the Supabase auth email
-- for that account. The client uses this to call signInWithPassword.
-- Email inputs are handled client-side (direct pass-through), so this
-- function is only invoked for non-email identifiers.
create or replace function public.resolve_login_identifier(identifier text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id    uuid;
  v_auth_email text;
  v_clean      text := trim(identifier);
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

  -- 2. Digits-only fallback (handles minor format drift)
  if v_user_id is null then
    select id into v_user_id
      from public.profiles
     where regexp_replace(phone, '[^0-9]', '', 'g')
           = regexp_replace(v_clean, '[^0-9]', '', 'g')
       and phone is not null and phone <> ''
     limit 1;
  end if;

  -- 3. Username (case-insensitive)
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

  -- Fetch the Supabase auth email for this user
  select email into v_auth_email
    from auth.users
   where id = v_user_id;

  return v_auth_email;
end;
$$;

grant execute on function public.resolve_login_identifier(text)
  to anon, authenticated;
