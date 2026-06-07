-- =============================================================
-- Fix #1: Tighten profiles RLS to eliminate app-wide data exposure
--
-- Root cause
-- ----------
-- Migration 20260522000000 added a "profiles: email lookup" SELECT
-- policy with USING (auth.uid() is not null).  Every authenticated
-- user could SELECT * from public.profiles and read every other
-- user's phone number, email, Expo push token, and payment handles
-- (Venmo, Cashapp, PayPal).
--
-- Fix strategy
-- ------------
-- 1. Drop the open policy.
-- 2. Create a SECURITY DEFINER helper has_profile_access() that
--    checks whether the caller has a recognised relationship with
--    the target profile (own row, shared debt, friend request, or
--    shared group membership).  SECURITY DEFINER prevents RLS
--    recursion when querying friend_requests / debts / group_members.
-- 3. Replace both the old owner-only SELECT policy and the open
--    email-lookup policy with a single relationship-based policy.
-- 4. Create a narrow SECURITY DEFINER RPC find_profile_by_email()
--    that returns only (id, display_name, avatar_url, email, username)
--    for the pre-relationship email-lookup use case — resolving a
--    contact's user_id before the first debt is created.
--
-- App impact
-- ----------
-- All existing cross-user profile reads remain functional:
--   • Own profile read/write       → own-profile branch of helper
--   • Debt counterpart name fill   → debt-relationship branch
--   • Friend request enrichment    → friend-request branch
--   • Group co-member display      → group-membership branch
--   • Email lookup (new contact)   → find_profile_by_email() RPC
--     (contactsService.ts must call this RPC instead of querying
--      the table directly; see the corresponding service change)
-- =============================================================

-- ── 1. Drop the open policy ───────────────────────────────────
drop policy if exists "profiles: email lookup" on public.profiles;

-- ── 2. Relationship-access helper ────────────────────────────
-- Returns true when auth.uid() is permitted to read the profile
-- row identified by p_profile_id.
-- Runs as SECURITY DEFINER to bypass RLS on the referenced tables
-- and avoid circular policy evaluation.

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

    -- Linked via a friend request (either direction, any status)
    or exists (
      select 1 from public.friend_requests
       where (sender_user_id    = auth.uid() and recipient_user_id = p_profile_id)
          or (recipient_user_id = auth.uid() and sender_user_id    = p_profile_id)
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

-- ── 3. Replace owner-only SELECT with relationship-based SELECT ──
-- Drop the original "profiles: owner select" policy so we replace
-- both old policies with one clean one.  The new policy includes the
-- own-profile check, so nothing is lost.

drop policy if exists "profiles: owner select" on public.profiles;

create policy "profiles: relationship select"
  on public.profiles for select
  using (public.has_profile_access(id));

-- ── 4. find_profile_by_email RPC ──────────────────────────────
-- Used by findOrCreateContactByEmail() in contactsService.ts when
-- no relationship exists yet between the caller and the target user
-- (i.e. the debt has not been created yet, so the relationship-based
-- policy would not return a row).
--
-- Returns only the minimum columns needed to resolve a linked_user_id:
-- id, display_name, avatar_url, username.
-- Sensitive columns (email, phone, expo_push_token, venmo_handle, etc.) are
-- never included in the result set.

create or replace function public.find_profile_by_email(p_email text)
returns table(
  id           uuid,
  display_name text,
  avatar_url   text,
  username     text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.display_name,
    p.avatar_url,
    p.username
  from public.profiles p
  where lower(p.email) = lower(trim(p_email))
    and p.email is not null
  limit 1;
$$;

grant execute on function public.find_profile_by_email(text) to authenticated;
