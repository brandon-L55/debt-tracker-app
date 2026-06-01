-- =============================================================
-- Extend debt_nudges with group context.
--
-- Adds a nullable group_id column so nudges sent from a group
-- page can be linked back to the originating group.
-- Also adds group_name for display purposes if the group is later
-- renamed or deleted.
-- =============================================================

alter table public.debt_nudges
  add column if not exists group_id   uuid references public.groups(id) on delete set null,
  add column if not exists group_name text;
