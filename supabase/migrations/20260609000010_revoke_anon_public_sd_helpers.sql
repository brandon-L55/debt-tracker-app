-- Security fix: four SECURITY DEFINER helpers were callable by unauthenticated
-- (anon) callers, acting as boolean oracles over private tables:
--
--   B. is_group_member          — reads group_members; leaks group membership
--   C. is_group_owner_or_member — reads groups + group_members; same oracle
--   D. has_profile_access       — reads friend_requests + group_members + debts;
--                                  leaks social-graph edges
--   E. nudge_recipient_can_update — reads debt_nudges; leaks nudge existence
--
-- Root cause: Supabase provisions direct EXECUTE grants to anon, authenticated,
-- and service_role on every function at project creation.  No REVOKE was ever
-- issued for any of these helpers.
--
-- Fix: revoke from PUBLIC (removes the implicit PostgreSQL default) and from anon
-- (removes the Supabase-provisioned direct grant).  The authenticated direct grant
-- is left in place — RLS policies and authenticated app callers are unaffected.

-- B. is_group_member(uuid, uuid)
revoke execute on function public.is_group_member(uuid, uuid) from public;
revoke execute on function public.is_group_member(uuid, uuid) from anon;

-- C. is_group_owner_or_member(uuid, uuid)
revoke execute on function public.is_group_owner_or_member(uuid, uuid) from public;
revoke execute on function public.is_group_owner_or_member(uuid, uuid) from anon;

-- D. has_profile_access(uuid)
revoke execute on function public.has_profile_access(uuid) from public;
revoke execute on function public.has_profile_access(uuid) from anon;

-- E. nudge_recipient_can_update(uuid, uuid, uuid, integer, text, uuid, uuid, text)
revoke execute on function public.nudge_recipient_can_update(uuid, uuid, uuid, integer, text, uuid, uuid, text) from public;
revoke execute on function public.nudge_recipient_can_update(uuid, uuid, uuid, integer, text, uuid, uuid, text) from anon;
