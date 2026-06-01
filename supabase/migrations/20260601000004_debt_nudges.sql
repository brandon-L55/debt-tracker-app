-- =============================================================
-- Debt nudges (in-app reminders)
--
-- Created when a lender taps "Nudge" on a linked user's profile.
-- The recipient reads these records to display nudge notifications.
-- =============================================================

create table if not exists public.debt_nudges (
  id                uuid        primary key default gen_random_uuid(),
  sender_user_id    uuid        not null references auth.users(id) on delete cascade,
  recipient_user_id uuid        not null references auth.users(id) on delete cascade,
  -- contact row on the sender's side — used for display purposes; nullable
  -- in case the contact is deleted after the nudge was sent.
  contact_id        uuid        references public.contacts(id) on delete set null,
  amount_cents      integer     not null check (amount_cents > 0),
  message           text        not null,
  read              boolean     not null default false,
  created_at        timestamptz not null default now(),
  check (sender_user_id <> recipient_user_id)
);

alter table public.debt_nudges enable row level security;

-- Sender can insert nudges they send.
create policy "debt_nudges: sender insert"
  on public.debt_nudges for insert
  with check (sender_user_id = auth.uid());

-- Either party can read nudges they are part of.
-- (Sender sees their sent nudges; recipient sees received nudges.)
-- Neither can read nudges between unrelated users.
create policy "debt_nudges: parties read"
  on public.debt_nudges for select
  using (sender_user_id = auth.uid() or recipient_user_id = auth.uid());

-- Recipient can mark nudges as read.
create policy "debt_nudges: recipient update"
  on public.debt_nudges for update
  using (recipient_user_id = auth.uid());
