-- =============================================================
-- Security: fix two confirmed identity vulnerabilities
--
-- Fix 1 — has_profile_access: rejected friend requests still grant
--   full profile SELECT.
--
--   Root cause: the friend_requests EXISTS clause had no status
--   filter.  After a victim rejected a request, the rejected sender
--   retained indefinite read access to phone, email, expo_push_token,
--   and payment handles because the rejected row still satisfied
--   has_profile_access().
--
--   Fix: add  AND status <> 'rejected'  to the friend_requests branch.
--   Parentheses around the OR pair are required — AND binds tighter
--   than OR so an unparenthesised filter would only apply to the
--   second OR arm.
--
-- Fix 2A — profiles UPDATE policy: email column has no domain
--   constraint.
--
--   Root cause: the "profiles: owner update" policy (as of
--   20260522000000) only checked  id = auth.uid().  Any authenticated
--   user could set profiles.email to any address not already claimed
--   by the unique index.  Two consequences:
--     a. find_profile_by_email / search_profiles return the attacker's
--        profile when queried with the spoofed email.
--     b. claim_invited_contacts (SECURITY DEFINER) read profiles.email
--        as trusted identity and would claim pending contact invites
--        for the spoofed address on the attacker's behalf.
--
--   Fix: replace the policy with one whose WITH CHECK locks email to
--   the caller's verified auth.users.email (or NULL for phone-only
--   accounts whose auth email is the synthetic ph_*@gotchulatr.internal
--   address — those accounts have no real email in profiles).
--
-- Fix 2B — claim_invited_contacts: read email from auth.users, not
--   from user-writable profiles.email.
--
--   This is a defence-in-depth fix independent of Fix 2A.  Even if
--   the UPDATE policy is later loosened, the RPC will never use a
--   value the caller can control directly.
--
-- App impact
-- ---------
--   • Rejected senders lose profile access  → no visible UX change
--     (getOutgoingFriendRequests filters status='pending'; rejected
--     outgoing requests are not shown in the UI).
--   • selfHealProfile and signUp both write auth.users.email into
--     profiles.email — these pass the new WITH CHECK unchanged.
--   • profileService.upsertProfile never writes email (not in
--     SELECT_FIELDS) — unaffected.
--   • claim_invited_contacts behaviour is identical for legitimate
--     callers; only spoofed-email attempts are now blocked.
-- =============================================================


-- ── Fix 1: has_profile_access — exclude rejected requests ─────
--
-- Full function replacement so the friend_requests clause gets the
-- corrected parenthesisation.  All other branches are identical to
-- the version in 20260606000002.

create or replace function public.has_profile_access(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    -- Own profile
    p_profile_id = auth.uid()

    -- Linked via a friend request that has NOT been rejected.
    -- 'pending' and 'accepted' both grant access; 'rejected' does not.
    -- Parentheses around the OR pair are required: AND binds tighter
    -- than OR, so without them the status filter would only apply to
    -- the second OR arm.
    or exists (
      select 1 from public.friend_requests
       where ((sender_user_id    = auth.uid() and recipient_user_id = p_profile_id)
               or (recipient_user_id = auth.uid() and sender_user_id    = p_profile_id))
         and status <> 'rejected'
    )

    -- Linked via a debt (creator, payer, or borrower on either side, any status)
    or exists (
      select 1 from public.debts
       where (creator_id       = auth.uid()
           or payer_user_id    = auth.uid()
           or borrower_user_id = auth.uid())
         and (creator_id       = p_profile_id
           or payer_user_id    = p_profile_id
           or borrower_user_id = p_profile_id)
    )

    -- Linked via shared group membership (both users have a row in the same group)
    or exists (
      select 1 from public.group_members gm1
       where gm1.user_id = auth.uid()
         and exists (
           select 1 from public.group_members gm2
            where gm2.group_id = gm1.group_id
              and gm2.user_id  = p_profile_id
         )
    );
$$;

-- has_profile_access is called only by the "profiles: relationship select"
-- RLS policy — no direct-call grant is required.


-- ── Fix 2A: profiles UPDATE policy — email domain constraint ──
--
-- Drop the existing policy (which had no WITH CHECK on email) and
-- replace it with one that constrains the email column.
--
-- The WITH CHECK allows email to be:
--   • NULL   — correct for phone-only accounts
--   • equal to the caller's verified auth.users.email — correct for
--     email-signup accounts and for selfHealProfile / signUp upserts
--
-- Synthetic auth emails (ph_*@gotchulatr.internal) are excluded from
-- the subquery so they can never appear in profiles.email; the only
-- valid value for phone-only accounts is NULL.

drop policy if exists "profiles: owner update" on public.profiles;

create policy "profiles: owner update"
  on public.profiles for update
  using  (id = auth.uid())
  with check (
    id = auth.uid()
    and (
      email is null
      or email = (
        select lower(trim(u.email))
          from auth.users u
         where u.id = auth.uid()
           and u.email not like '%@gotchulatr.internal'
      )
    )
  );


-- ── Fix 2B: claim_invited_contacts — authoritative email source ─
--
-- Rewrite to read from auth.users rather than user-writable
-- profiles.email.  auth.users.email is set exclusively by Supabase
-- auth flows and cannot be manipulated by the caller.
--
-- Phone-only accounts have a synthetic auth email; the  NOT LIKE
-- filter returns null for them so the function exits early — those
-- accounts never had invites sent to an internal address.

create or replace function public.claim_invited_contacts()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  if auth.uid() is null then
    return;
  end if;

  -- Use auth.users as the authoritative email source.
  -- profiles.email is user-writable; reading it here would allow a
  -- caller who set profiles.email to an arbitrary address to claim
  -- contact invites intended for someone else.
  select lower(trim(email))
  into   v_email
  from   auth.users
  where  id = auth.uid()
    and  email not like '%@gotchulatr.internal';

  if v_email is null or v_email = '' then
    return;
  end if;

  update public.contacts
     set linked_user_id = auth.uid(),
         invite_status  = 'claimed'
   where lower(trim(invited_email)) = v_email
     and (linked_user_id is null or linked_user_id = auth.uid());
end;
$$;

grant execute on function public.claim_invited_contacts()
  to authenticated;
