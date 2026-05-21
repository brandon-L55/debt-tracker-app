-- =============================================================
-- Add app-specific columns to contacts table.
-- These columns support the Individuals feature:
--   nickname, username (phone/handle), notes, sort_order,
--   pinned, silenced, and an optional linked_user_id for
--   matching a contact to a registered user.
-- =============================================================

alter table public.contacts
  add column if not exists linked_user_id uuid references auth.users(id) on delete set null;

alter table public.contacts
  add column if not exists nickname      text;

alter table public.contacts
  add column if not exists username      text;

alter table public.contacts
  add column if not exists notes         text;

alter table public.contacts
  add column if not exists sort_order    integer not null default 0;

alter table public.contacts
  add column if not exists pinned        boolean not null default false;

alter table public.contacts
  add column if not exists silenced      boolean not null default false;

-- Index for efficient ordered fetches per owner
create index if not exists contacts_owner_sort_idx
  on public.contacts(owner_id, sort_order);
