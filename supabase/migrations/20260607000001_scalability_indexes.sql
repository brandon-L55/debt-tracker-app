-- =============================================================
-- Scalability: add missing indexes
--
-- The initial schema created single-column indexes on the main FK
-- columns. This migration adds what is missing:
--
--   contacts.linked_user_id        — resolvePersonForDebt lookups
--   contacts(owner_id, linked_user_id) partial
--                                  — find a specific linked contact
--   debts(creator_id, status)      — composite for filtered debt queries
--   debts(payer_user_id, status)   — composite
--   debts(borrower_user_id, status)— composite
--   debts(group_id, status)        — group simplification query
--   debts.paid_at                  — history sort
--   group_members.contact_id       — group simplification lookups
--
-- Omitted (already covered):
--   debts.client_request_id        — unique constraint = implicit index
--   payments.client_request_id     — unique constraint = implicit index
--   payments.debt_id               — already in initial schema
--   payments.payer_user_id         — already in initial schema
--
-- All use IF NOT EXISTS — safe to re-run.
-- =============================================================

-- contacts: look up a contact by linked app-user id
create index if not exists contacts_linked_user_id_idx
  on public.contacts(linked_user_id)
  where linked_user_id is not null;

-- contacts: owner + linked together (avoids double scan in resolvePersonForDebt)
create index if not exists contacts_owner_linked_idx
  on public.contacts(owner_id, linked_user_id)
  where linked_user_id is not null;

-- debts composites: status filter layered on each participant column
create index if not exists debts_creator_status_idx
  on public.debts(creator_id, status);

create index if not exists debts_payer_status_idx
  on public.debts(payer_user_id, status)
  where payer_user_id is not null;

create index if not exists debts_borrower_status_idx
  on public.debts(borrower_user_id, status)
  where borrower_user_id is not null;

create index if not exists debts_group_status_idx
  on public.debts(group_id, status)
  where group_id is not null;

-- debts: paid_at for history ordering
create index if not exists debts_paid_at_idx
  on public.debts(paid_at desc)
  where paid_at is not null;

-- group_members: contact-side lookups in simplification service
create index if not exists group_members_contact_id_idx
  on public.group_members(contact_id)
  where contact_id is not null;
