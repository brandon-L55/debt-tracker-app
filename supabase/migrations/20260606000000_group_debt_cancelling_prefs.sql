-- =============================================================
-- group_debt_cancelling_preferences — missing table definition
--
-- This table was created directly in the Supabase dashboard without
-- a migration file.  This migration adds it to version control so
-- the full schema is reproducible from migrations alone.
--
-- Ordering note: migration 20260606000001 subsequently replaces the
-- owner-only SELECT policy with a group-member-scoped one; this file
-- must run first.  The filename 20260606000000 guarantees that on a
-- fresh database.  On a production database that already has the
-- table, all DDL is idempotent (IF NOT EXISTS / DO blocks).
-- =============================================================

create table if not exists public.group_debt_cancelling_preferences (
  -- Which group and which member this preference belongs to.
  group_id   uuid        not null references public.groups(id)  on delete cascade,
  user_id    uuid        not null references auth.users(id)     on delete cascade,
  -- Has the user seen and dismissed the feature introduction screen?
  intro_seen boolean     not null default false,
  -- Has the user opted in to Debt Cancelling for this group?
  enabled    boolean     not null default false,
  updated_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

-- Reuse the shared set_updated_at() trigger helper from the initial schema.
do $$
begin
  create trigger trg_group_debt_cancelling_prefs_updated_at
    before update on public.group_debt_cancelling_preferences
    for each row execute function public.set_updated_at();
exception when duplicate_object then null;
end $$;

alter table public.group_debt_cancelling_preferences enable row level security;

-- ── RLS policies ──────────────────────────────────────────────

-- SELECT: owner sees their own row only.
-- (Migration 20260606000001 replaces this with a group-member-scoped policy
-- so the simplification service can read all opted-in members for a group.)
do $$
begin
  create policy "debt_cancelling_prefs: owner select"
    on public.group_debt_cancelling_preferences for select
    using (user_id = auth.uid());
exception when duplicate_object then null;
end $$;

-- INSERT: a user may only create their own preference row.
do $$
begin
  create policy "debt_cancelling_prefs: owner insert"
    on public.group_debt_cancelling_preferences for insert
    with check (user_id = auth.uid());
exception when duplicate_object then null;
end $$;

-- UPDATE: a user may only modify their own preference row.
do $$
begin
  create policy "debt_cancelling_prefs: owner update"
    on public.group_debt_cancelling_preferences for update
    using  (user_id = auth.uid())
    with check (user_id = auth.uid());
exception when duplicate_object then null;
end $$;
