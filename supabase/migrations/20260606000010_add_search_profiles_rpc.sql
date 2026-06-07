-- =============================================================
-- Fix: version-control search_profiles and strip private fields
--
-- This function was previously untracked (created in the Supabase
-- dashboard without a migration) and its return columns were
-- unknown from the codebase.  The TypeScript caller expected
-- phone and email in the response — if the live function returned
-- those fields it would bypass the relationship-gated profiles
-- SELECT policy added in 20260606000002_fix_profiles_rls.sql,
-- allowing any authenticated user to cross-resolve phone ↔ email
-- for arbitrary accounts with no prior relationship.
--
-- This migration:
--   1. Defines search_profiles in version control.
--   2. Returns only (id, display_name, username, avatar_url).
--      Phone, email, payment handles, and expo_push_token are
--      never included in the result.
--   3. Uses SECURITY DEFINER so the pre-relationship lookup works
--      (the caller has no debt/friend relationship with the target
--      yet, so the relationship-gated policy would return nothing).
--   4. Grants execute to authenticated only — not anon.
-- =============================================================

drop function if exists public.search_profiles(text);

create or replace function public.search_profiles(query text)
returns table(
  id           uuid,
  display_name text,
  username     text,
  avatar_url   text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.display_name,
    p.username,
    p.avatar_url
  from public.profiles p
  where
    -- Exact phone match (client normalises before calling)
    (p.phone is not null
       and p.phone = trim(query))

    -- Digits-only fallback for minor format drift (+1 555… vs 1555…)
    or (p.phone is not null
        and p.phone <> ''
        and trim(query) <> ''
        and regexp_replace(p.phone,       '[^0-9]', '', 'g') <> ''
        and regexp_replace(p.phone,       '[^0-9]', '', 'g')
          = regexp_replace(trim(query),   '[^0-9]', '', 'g'))

    -- Username match (case-insensitive; leading @ stripped from input)
    or (p.username is not null
        and p.username <> ''
        and lower(p.username) = lower(ltrim(trim(query), '@')))

    -- Email match (case-insensitive)
    or (p.email is not null
        and lower(p.email) = lower(trim(query)))

  limit 1;
$$;

-- Explicitly revoke from public and anon so the function cannot be
-- called by unauthenticated requests, then grant to authenticated only.
revoke execute on function public.search_profiles(text) from public, anon;
grant  execute on function public.search_profiles(text) to authenticated;
