-- Security fix: find_profile_by_email() is SECURITY DEFINER and was
-- callable by anonymous (unauthenticated) callers.
--
-- Root cause: 20260606000002 added GRANT EXECUTE TO authenticated but
-- never issued REVOKE EXECUTE FROM PUBLIC.  PostgreSQL's default grants
-- EXECUTE to PUBLIC on every new function, so the anon role retained
-- access regardless of the authenticated-only grant.
--
-- Impact: any unauthenticated caller could invoke the RPC with an
-- arbitrary email and receive id, display_name, avatar_url, username
-- for any registered user — bypassing all RLS.
--
-- Fix: revoke from public.  The explicit GRANT to authenticated
-- (issued in 20260606000002) is unaffected; authenticated app callers
-- continue to work without any change.

revoke execute on function public.find_profile_by_email(text) from public;
