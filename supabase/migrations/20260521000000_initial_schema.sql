-- =============================================================
-- Debt Tracker — Initial Schema + RLS Policies
-- Run this in the Supabase SQL Editor (or via supabase db push)
--
-- Ordering rules to avoid forward-reference errors:
--   Phase 1 — Helper functions (no table deps)
--   Phase 2 — All table DDL (CREATE TABLE, indexes, triggers)
--   Phase 3 — Auth trigger (handle_new_user on auth.users)
--   Phase 4 — Enable RLS on every table
--   Phase 5 — Helper functions used inside policies
--   Phase 6 — All RLS policies (all tables exist by now)
-- =============================================================


-- ─────────────────────────────────────────────
-- Phase 1: Helper functions
-- ─────────────────────────────────────────────

-- Automatically update updated_at on any row change
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ─────────────────────────────────────────────
-- Phase 2: Table DDL
-- (All tables created before any policy references them)
-- ─────────────────────────────────────────────

-- 2a. PROFILES
--     One row per authenticated user.

create table if not exists public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  display_name   text,
  avatar_url     text,
  venmo_handle   text,
  cashapp_handle text,
  paypal_handle  text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();


-- 2b. CONTACTS
--     Personal address book entries owned by one user.

create table if not exists public.contacts (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references auth.users(id) on delete cascade,
  name           text not null,
  phone          text,
  email          text,
  venmo_handle   text,
  cashapp_handle text,
  paypal_handle  text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists contacts_owner_id_idx on public.contacts(owner_id);

create trigger trg_contacts_updated_at
  before update on public.contacts
  for each row execute function public.set_updated_at();


-- 2c. GROUPS
--     A named collection of people sharing expenses.

create table if not exists public.groups (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists groups_owner_id_idx on public.groups(owner_id);

create trigger trg_groups_updated_at
  before update on public.groups
  for each row execute function public.set_updated_at();


-- 2d. GROUP_MEMBERS
--     Junction: who belongs to which group.

create table if not exists public.group_members (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references public.groups(id) on delete cascade,
  user_id      uuid references auth.users(id) on delete set null,   -- null → invited but not signed up yet
  contact_id   uuid references public.contacts(id) on delete set null,
  display_name text,   -- fallback label when neither user_id nor contact_id resolves a name
  role         text not null default 'member' check (role in ('owner', 'member')),
  joined_at    timestamptz not null default now(),
  constraint group_members_unique unique (group_id, user_id)
);

create index if not exists group_members_group_id_idx on public.group_members(group_id);
create index if not exists group_members_user_id_idx  on public.group_members(user_id);


-- 2e. DEBTS
--     A money obligation between two parties, optionally inside a group.

create type public.debt_status as enum (
  'pending',
  'accepted',
  'rejected',
  'disputed',
  'partial',
  'paid'
);

create table if not exists public.debts (
  id                  uuid primary key default gen_random_uuid(),
  creator_id          uuid not null references auth.users(id) on delete cascade,
  -- Who owes whom
  payer_user_id       uuid references auth.users(id)     on delete set null,
  payer_contact_id    uuid references public.contacts(id) on delete set null,
  borrower_user_id    uuid references auth.users(id)     on delete set null,
  borrower_contact_id uuid references public.contacts(id) on delete set null,
  -- Optional group context
  group_id            uuid references public.groups(id)  on delete set null,
  -- Amount
  amount_cents        integer not null check (amount_cents > 0),
  currency            text not null default 'USD',
  description         text,
  -- State
  status              public.debt_status not null default 'pending',
  due_date            date,
  -- Timestamps
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  -- At least one side must be set
  constraint debts_payer_set    check (payer_user_id   is not null or payer_contact_id   is not null),
  constraint debts_borrower_set check (borrower_user_id is not null or borrower_contact_id is not null)
);

create index if not exists debts_creator_id_idx       on public.debts(creator_id);
create index if not exists debts_payer_user_id_idx    on public.debts(payer_user_id);
create index if not exists debts_borrower_user_id_idx on public.debts(borrower_user_id);
create index if not exists debts_group_id_idx         on public.debts(group_id);
create index if not exists debts_status_idx           on public.debts(status);

create trigger trg_debts_updated_at
  before update on public.debts
  for each row execute function public.set_updated_at();


-- 2f. PAYMENTS
--     A partial or full settlement against a debt.

create table if not exists public.payments (
  id            uuid primary key default gen_random_uuid(),
  debt_id       uuid not null references public.debts(id) on delete cascade,
  payer_user_id uuid references auth.users(id) on delete set null,
  amount_cents  integer not null check (amount_cents > 0),
  currency      text not null default 'USD',
  note          text,
  paid_at       timestamptz not null default now(),
  created_at    timestamptz not null default now()
  -- No updated_at: payments are immutable records; create a new one to correct
);

create index if not exists payments_debt_id_idx       on public.payments(debt_id);
create index if not exists payments_payer_user_id_idx on public.payments(payer_user_id);


-- ─────────────────────────────────────────────
-- Phase 3: Auth trigger
--           (tables must exist before this runs)
-- ─────────────────────────────────────────────

-- Auto-create a profile row when a new user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ─────────────────────────────────────────────
-- Phase 4: Enable RLS on all tables
-- ─────────────────────────────────────────────

alter table public.profiles      enable row level security;
alter table public.contacts      enable row level security;
alter table public.groups        enable row level security;
alter table public.group_members enable row level security;
alter table public.debts         enable row level security;
alter table public.payments      enable row level security;


-- ─────────────────────────────────────────────
-- Phase 5: Helper function used inside policies
-- ─────────────────────────────────────────────

-- Reusable check: is the current user a member of a group?
-- SECURITY DEFINER so policies can call it without the caller needing
-- direct SELECT on group_members, avoiding circular RLS issues.
create or replace function public.is_group_member(p_group_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.group_members
    where group_id = p_group_id
      and user_id  = p_user_id
  );
$$;


-- ─────────────────────────────────────────────
-- Phase 6: RLS Policies
-- (all tables guaranteed to exist by this point)
-- ─────────────────────────────────────────────

-- ── profiles ──────────────────────────────────
-- Users can read and write only their own profile.

create policy "profiles: owner select"
  on public.profiles for select
  using (id = auth.uid());

create policy "profiles: owner insert"
  on public.profiles for insert
  with check (id = auth.uid());

create policy "profiles: owner update"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "profiles: owner delete"
  on public.profiles for delete
  using (id = auth.uid());


-- ── contacts ──────────────────────────────────
-- Only the owner sees and mutates their own contacts.

create policy "contacts: owner all"
  on public.contacts for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());


-- ── groups ────────────────────────────────────
-- Any member of the group can read it; only the owner can write.
-- group_members table exists here, so this SELECT policy is safe.

create policy "groups: member select"
  on public.groups for select
  using (
    owner_id = auth.uid()
    or exists (
      select 1 from public.group_members gm
      where gm.group_id = id
        and gm.user_id  = auth.uid()
    )
  );

create policy "groups: owner insert"
  on public.groups for insert
  with check (owner_id = auth.uid());

create policy "groups: owner update"
  on public.groups for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "groups: owner delete"
  on public.groups for delete
  using (owner_id = auth.uid());


-- ── group_members ──────────────────────────────
-- Members of a group can see who else is in it.
-- Only the group owner can add/update/remove members.

create policy "group_members: group member select"
  on public.group_members for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.group_members gm2
      where gm2.group_id = group_id
        and gm2.user_id  = auth.uid()
    )
  );

create policy "group_members: owner insert"
  on public.group_members for insert
  with check (
    exists (
      select 1 from public.groups g
      where g.id       = group_id
        and g.owner_id = auth.uid()
    )
  );

create policy "group_members: owner update"
  on public.group_members for update
  using (
    exists (
      select 1 from public.groups g
      where g.id       = group_id
        and g.owner_id = auth.uid()
    )
  );

create policy "group_members: owner delete"
  on public.group_members for delete
  using (
    exists (
      select 1 from public.groups g
      where g.id       = group_id
        and g.owner_id = auth.uid()
    )
  );


-- ── debts ─────────────────────────────────────
-- Visible to creator, payer, borrower, or any group member.
-- Only the creator can mutate.

create policy "debts: participant select"
  on public.debts for select
  using (
    creator_id          = auth.uid()
    or payer_user_id    = auth.uid()
    or borrower_user_id = auth.uid()
    or (group_id is not null and public.is_group_member(group_id, auth.uid()))
  );

create policy "debts: creator insert"
  on public.debts for insert
  with check (creator_id = auth.uid());

create policy "debts: creator update"
  on public.debts for update
  using (creator_id = auth.uid())
  with check (creator_id = auth.uid());

create policy "debts: creator delete"
  on public.debts for delete
  using (creator_id = auth.uid());


-- ── payments ──────────────────────────────────
-- Access mirrors debt access: if you can see the debt you can see its payments.
-- Only the debt creator or payer can record a payment.
-- Payments are immutable — no UPDATE or DELETE policy.

create policy "payments: debt participant select"
  on public.payments for select
  using (
    exists (
      select 1 from public.debts d
      where d.id = debt_id
        and (
          d.creator_id          = auth.uid()
          or d.payer_user_id    = auth.uid()
          or d.borrower_user_id = auth.uid()
          or (d.group_id is not null and public.is_group_member(d.group_id, auth.uid()))
        )
    )
  );

create policy "payments: debt creator insert"
  on public.payments for insert
  with check (
    exists (
      select 1 from public.debts d
      where d.id = debt_id
        and (d.creator_id = auth.uid() or d.payer_user_id = auth.uid())
    )
  );


-- ─────────────────────────────────────────────
-- Done.
-- ─────────────────────────────────────────────
