-- =============================================================
-- reset_account() — v3: guarantee display_name is preserved
--
-- Root-cause fix: migrations 20260602000000 and 20260602000001 were
-- both already applied to the live DB before 000001 was edited on
-- disk.  Supabase only runs each migration once, so editing an applied
-- file has no effect.  This new migration re-issues CREATE OR REPLACE
-- to overwrite the live function definition.
--
-- Preserved: display_name, phone, username, email,
--            avatar_url, expo_push_token
-- Cleared:   venmo_handle, cashapp_handle, paypal_handle
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
  --    ON DELETE CASCADE removes all payments attached to these debts.
  delete from public.debts
  where creator_id       = v_uid
     or payer_user_id    = v_uid
     or borrower_user_id = v_uid;

  -- 5. Delete all contacts the caller owns.
  --    Step 4 already removed all debts referencing these contacts, so
  --    the FK ON DELETE SET NULL has nothing left to cascade — no violation.
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
  --    display_name is intentionally NOT cleared — it is a persistent
  --    identity field the user set and should survive a data reset.
  update public.profiles
  set venmo_handle   = null,
      cashapp_handle = null,
      paypal_handle  = null,
      updated_at     = now()
  where id = v_uid;

end;
$$;

grant execute on function public.reset_account() to authenticated;
