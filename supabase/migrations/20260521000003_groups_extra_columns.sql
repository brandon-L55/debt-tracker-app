-- =============================================================
-- Add app-required columns to groups and group_members.
-- Adds a second RLS SELECT policy so group owners can always
-- read their group's member list (the initial policy only
-- grants access to users who appear as a registered member).
-- Safe to run multiple times (columns use IF NOT EXISTS;
-- policy creation is wrapped in a DO block to ignore duplicates).
-- =============================================================

-- ── groups: extra columns ─────────────────────────────────────

alter table public.groups
  add column if not exists image_url  text;

alter table public.groups
  add column if not exists sort_order integer not null default 0;

alter table public.groups
  add column if not exists pinned     boolean not null default false;

alter table public.groups
  add column if not exists silenced   boolean not null default false;

-- Index for efficient ordered fetches per owner
create index if not exists groups_owner_sort_idx
  on public.groups(owner_id, sort_order);


-- ── group_members: extra column ───────────────────────────────
-- Stores the phone / username of manually-added members
-- (members not linked to a contacts row or registered user).

alter table public.group_members
  add column if not exists phone_or_username text;


-- ── RLS: allow group owner to read all members ────────────────
-- The initial "group_members: group member select" policy only
-- allows a row to be read when the current user appears as a
-- registered member (user_id = auth.uid()). That excludes the
-- group owner when all members are contacts with no user_id.
-- This additional policy closes that gap.

do $$
begin
  create policy "group_members: group owner select"
    on public.group_members for select
    using (
      exists (
        select 1 from public.groups g
        where g.id       = group_id
          and g.owner_id = auth.uid()
      )
    );
exception when duplicate_object then
  null;  -- already applied; safe to ignore
end $$;
