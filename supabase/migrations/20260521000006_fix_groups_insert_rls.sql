-- =============================================================
-- Fix: "new row violates row-level security policy for table groups"
--
-- Drops every known name variant of the groups INSERT policy that
-- may exist in the live database (from migrations or manual edits),
-- then recreates it cleanly scoped to the `authenticated` role.
--
-- Safe to run multiple times (all drops are IF EXISTS).
-- =============================================================

-- Drop all known name variants so we start clean.
drop policy if exists "Users can create groups"  on public.groups;
drop policy if exists "groups_insert_own"         on public.groups;
drop policy if exists "groups: owner insert"      on public.groups;

-- Recreate with explicit `to authenticated` so the policy is
-- only evaluated for logged-in users, and `auth.uid()` is
-- guaranteed non-null when the check runs.
create policy "groups_insert_own"
  on public.groups
  for insert
  to authenticated
  with check (auth.uid() = owner_id);
