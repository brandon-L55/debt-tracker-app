-- =============================================================
-- Fix: "new row violates row-level security policy for table groups"
--
-- Idempotently recreates the groups INSERT policy so the live DB
-- matches the intended schema regardless of prior apply state.
--
-- Root cause: groups INSERT policy (owner_id = auth.uid()) may be
-- missing or malformed in the live database.
--
-- Safe to run multiple times.
-- =============================================================

-- Drop and recreate the groups INSERT policy.
-- with check (owner_id = auth.uid()) ensures only the owner can insert
-- a row where owner_id matches their own authenticated user id.

drop policy if exists "groups: owner insert" on public.groups;

create policy "groups: owner insert"
  on public.groups for insert
  with check (owner_id = auth.uid());
