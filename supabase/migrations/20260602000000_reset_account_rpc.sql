-- =============================================================
-- reset_account()
--
-- Deletes or detaches all data owned by or directly associated
-- with the calling user.  Runs as SECURITY DEFINER so it can
-- bypass RLS to touch only the calling user's own rows.
--
-- What is deleted:
--   debt_nudges         — rows where caller is sender or recipient
--   friend_requests     — rows where caller is sender or recipient
--   group_members       — rows where caller is a member (non-owner)
--   debts               — rows created by caller (cascades to payments)
--   contacts            — rows owned by caller
--   groups              — rows owned by caller (cascades to group_members)
--
-- What is detached (NULLed in other users' data):
--   contacts.linked_user_id — other users' contact cards linked to caller
--   profiles fields         — display_name, venmo_handle, cashapp_handle,
--                             paypal_handle cleared (login identifiers,
--                             avatar_url, and expo_push_token are preserved)
--
-- What is NOT touched:
--   Debts or payments created by OTHER users where caller is a participant —
--   those rows stay as-is; the profile clear makes the caller appear
--   unnamed to the other party, which is preferable to deleting their record.
-- =============================================================

create or replace function public.reset_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  -- 1. Nudges (bidirectional)
  delete from public.debt_nudges
  where sender_user_id = v_uid
     or recipient_user_id = v_uid;

  -- 2. Friend requests (bidirectional)
  delete from public.friend_requests
  where sender_user_id = v_uid
     or recipient_user_id = v_uid;

  -- 3. Remove caller from all groups they joined (non-owner membership rows).
  --    Groups the caller owns are handled below with the full group delete.
  delete from public.group_members
  where user_id = v_uid;

  -- 4. Delete all debts the caller created.
  --    FK ON DELETE CASCADE removes all payments that belong to those debts.
  delete from public.debts
  where creator_id = v_uid;

  -- 5. Delete all contacts the caller owns.
  --    FK ON DELETE SET NULL clears contact_id refs in group_members and debts
  --    that reference these contacts.  Because the caller's own debts were
  --    already deleted in step 4, the cascade only touches other users' rows
  --    (which is safe — nullable FK, no check-constraint violation possible).
  delete from public.contacts
  where owner_id = v_uid;

  -- 6. Delete all groups the caller owns.
  --    FK ON DELETE CASCADE removes all group_members rows for those groups.
  delete from public.groups
  where owner_id = v_uid;

  -- 7. Unlink caller from other users' contact cards.
  update public.contacts
  set linked_user_id = null
  where linked_user_id = v_uid;

  -- 8. Clear mutable profile fields; preserve login identifiers and
  --    avatar_url / expo_push_token per product spec.
  update public.profiles
  set display_name   = null,
      venmo_handle   = null,
      cashapp_handle = null,
      paypal_handle  = null,
      updated_at     = now()
  where id = v_uid;

end;
$$;

grant execute on function public.reset_account() to authenticated;
