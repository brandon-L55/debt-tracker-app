-- =============================================================
-- reset_account() — bug-fix revision
--
-- Fixes:
--   1. Debts where the caller is payer or borrower (but not creator)
--      were previously left behind.  Expanded the DELETE to cover all
--      debts where the caller is any party so the debt list is fully
--      cleared after reset.
--
-- Unchanged from v1:
--   - Nudges, friend_requests, group_members, contacts, groups deleted
--   - linked_user_id detached from other users' contact cards
--   - Profile fields cleared (display_name, avatar_url, expo_push_token preserved)
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

  -- 4. Delete every debt where caller is any party: creator, payer, or borrower.
  --    Previously only creator_id debts were removed, leaving participant-only
  --    debts visible via the "debts: participant select" RLS policy.
  --    ON DELETE CASCADE removes all payments attached to these debts.
  delete from public.debts
  where creator_id       = v_uid
     or payer_user_id    = v_uid
     or borrower_user_id = v_uid;

  -- 5. Delete all contacts the caller owns.
  --    Because step 4 already removed all debts that could reference these
  --    contacts (either as creator or participant), the FK ON DELETE SET NULL
  --    cascade on debts.payer_contact_id / borrower_contact_id has no rows
  --    left to update — no check-constraint violation is possible.
  delete from public.contacts
  where owner_id = v_uid;

  -- 6. Delete all groups the caller owns (cascades to their group_members rows).
  delete from public.groups
  where owner_id = v_uid;

  -- 7. Unlink caller from other users' contact cards.
  update public.contacts
  set linked_user_id = null
  where linked_user_id = v_uid;

  -- 8. Clear mutable profile fields.
  --    Preserves: display_name, phone, username, email (login identifiers),
  --               avatar_url and expo_push_token (per product spec).
  update public.profiles
  set venmo_handle   = null,
      cashapp_handle = null,
      paypal_handle  = null,
      updated_at     = now()
  where id = v_uid;

end;
$$;

grant execute on function public.reset_account() to authenticated;
