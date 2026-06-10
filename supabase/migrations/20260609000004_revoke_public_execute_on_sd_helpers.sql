-- Security fix: SECURITY DEFINER helpers were executable by PUBLIC.
-- PostgreSQL grants EXECUTE to PUBLIC by default when a function is created.
-- The previous migrations only added GRANT to authenticated without revoking PUBLIC,
-- meaning unauthenticated (anon) callers could invoke these definer-context functions
-- and read debt rows they have no direct RLS access to.
--
-- Fix: revoke the implicit PUBLIC grant; authenticated-only grant remains.

revoke execute on function public.debt_accept_reject_is_valid(
  uuid, uuid, uuid, uuid, uuid, uuid,
  integer, text, text, uuid, date,
  integer, timestamptz, boolean, text, integer, text
) from public;

revoke execute on function public.debt_undo_manual_paid_is_valid(uuid) from public;
