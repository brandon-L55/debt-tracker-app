-- =============================================================
-- Fix: infinite recursion in groups / group_members RLS policies
--
-- Root cause:
--   "groups: member select"             queries group_members directly
--   "group_members: group owner select" queries groups
--   "group_members: group member select" self-joins group_members
--   → circular dependency at policy evaluation time
--
-- Fix:
--   1. Add SECURITY DEFINER helper is_group_owner_or_member()
--      that queries both tables without triggering their RLS.
--   2. Replace all three recursive policies with calls to the helper.
--
-- The INSERT / UPDATE / DELETE policies on group_members are left
-- unchanged — they query groups, but after this fix the groups SELECT
-- policy calls the SECURITY DEFINER helper (no inner recursion).
-- =============================================================


-- ── Step 1: SECURITY DEFINER helper ──────────────────────────
-- Checks ownership OR registered membership in a group.
-- Runs as the function definer (bypasses RLS on both tables),
-- breaking the circular evaluation chain.

create or replace function public.is_group_owner_or_member(
  p_group_id uuid,
  p_user_id  uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1 from public.groups
      where id = p_group_id and owner_id = p_user_id
    )
    or exists (
      select 1 from public.group_members
      where group_id = p_group_id and user_id = p_user_id
    );
$$;


-- ── Step 2: Fix groups SELECT policy ─────────────────────────
-- Old policy queried group_members directly → recursion.
-- New policy delegates to the SECURITY DEFINER helper.

drop policy if exists "groups: member select" on public.groups;

create policy "groups: member select"
  on public.groups for select
  using (public.is_group_owner_or_member(id, auth.uid()));


-- ── Step 3: Fix group_members SELECT policies ─────────────────
-- "group_members: group member select" had a self-join → recursion.
-- "group_members: group owner select"  queried groups → recursion.
-- Replace both with a single policy using the SECURITY DEFINER helper.

drop policy if exists "group_members: group member select" on public.group_members;
drop policy if exists "group_members: group owner select"  on public.group_members;

create policy "group_members: member or owner select"
  on public.group_members for select
  using (public.is_group_owner_or_member(group_id, auth.uid()));


-- ── Done ──────────────────────────────────────────────────────
