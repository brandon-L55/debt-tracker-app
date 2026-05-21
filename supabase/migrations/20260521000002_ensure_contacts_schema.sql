-- =============================================================
-- Ensure all app-required columns exist on public.contacts.
-- Safe to run multiple times (all use IF NOT EXISTS).
-- Apply in Supabase SQL Editor if the previous migration
-- (20260521000001_contacts_extra_columns.sql) was never run.
-- =============================================================

alter table public.contacts
  add column if not exists linked_user_id  uuid references auth.users(id) on delete set null;

alter table public.contacts
  add column if not exists avatar_url      text;

alter table public.contacts
  add column if not exists nickname        text;

alter table public.contacts
  add column if not exists username        text;

alter table public.contacts
  add column if not exists notes           text;

alter table public.contacts
  add column if not exists sort_order      integer not null default 0;

alter table public.contacts
  add column if not exists pinned          boolean not null default false;

alter table public.contacts
  add column if not exists silenced        boolean not null default false;

-- Index for efficient ordered fetches per owner (idempotent).
create index if not exists contacts_owner_sort_idx
  on public.contacts(owner_id, sort_order);
