-- Supabase projects grant EXECUTE to anon, authenticated, and service_role
-- explicitly on every function at project initialisation — in addition to
-- the implicit PUBLIC grant.  Migration 20260609000008 revoked from PUBLIC
-- but left the direct anon grant intact, so unauthenticated callers could
-- still invoke find_profile_by_email().
--
-- Fix: revoke from the anon role directly.
-- The authenticated grant is preserved; service_role is unaffected.

revoke execute on function public.find_profile_by_email(text) from anon;
