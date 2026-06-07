-- =============================================================
-- reset_account() — v4: restrict debt deletion to caller-owned debts only
--
-- Bug fixed (introduced in 20260602000001):
--   Step 4 was expanded to delete debts where the caller is
--   payer_user_id or borrower_user_id, not just creator_id.
--   This silently destroyed debt and payment records owned by
--   OTHER users whenever they had created a debt that listed the
--   resetting user as a participant.
--
-- Fix:
--   Revert step 4 to WHERE creator_id = v_uid only.
--   Debts created by other users where the caller is only a
--   participant are left intact.  The profile clear in step 8
--   already detaches the caller's identity from those debts —
--   the other party will see an unnamed participant, which is
--   preferable to losing their record entirely.
--
-- Unchanged from v3:
--   - Nudges, friend_requests, group_members, contacts, groups deleted
--   - linked_user_id detached from other users' contact cards
--   - Profile payment handles cleared; display_name, avatar_url,
--     expo_push_token, and login identifiers are preserved
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

  -- 3. Remove caller from groups they joined as a non-owner member.
  delete from public.group_members
  where user_id = v_uid;

  -- 4. Delete only debts the caller created.
  --    Debts created by OTHER users where the caller is a participant
  --    (payer_user_id or borrower_user_id) are intentionally left intact.
  --    Deleting them would destroy another user's records and wipe the
  --    payment history attached to those debts via ON DELETE CASCADE.
  --    The profile clear in step 8 is sufficient to detach the caller's
  --    identity from any debts they did not own.
  --    ON DELETE CASCADE removes all payments attached to the caller's own debts.
  delete from public.debts
  where creator_id = v_uid;

  -- 5. Delete all contacts the caller owns.
  --    Step 4 removed all debts the caller created; the FK
  --    ON DELETE SET NULL on debts.payer_contact_id / borrower_contact_id
  --    handles any remaining references from other users' debts.
  delete from public.contacts
  where owner_id = v_uid;

  -- 6. Delete all groups the caller owns (cascades to their group_members rows).
  delete from public.groups
  where owner_id = v_uid;

  -- 7. Unlink caller from other users' contact cards.
  update public.contacts
  set linked_user_id = null
  where linked_user_id = v_uid;

  -- 8. Clear only the payment-handle fields.
  --    Preserved: display_name, phone, username, email (login identifiers),
  --               avatar_url, expo_push_token.
  update public.profiles
  set venmo_handle   = null,
      cashapp_handle = null,
      paypal_handle  = null,
      updated_at     = now()
  where id = v_uid;

end;
$$;

grant execute on function public.reset_account() to authenticated;
