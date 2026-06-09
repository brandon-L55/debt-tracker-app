-- =============================================================
-- Fix C-1: debt participant accept/reject policy — pin immutable columns
--
-- Root cause
-- ----------
-- "debts: participant accept or reject" (20260523000000) had a WITH CHECK
-- of only `status in ('accepted', 'rejected')`.  In PostgreSQL permissive
-- RLS an UPDATE succeeds when the new row satisfies ANY policy's WITH CHECK.
-- This meant a non-creator participant could set status = 'accepted' and
-- simultaneously change any other column:
--
--   • creator_id          — transfer creator ownership to themselves
--   • amount_cents        — reduce the debt amount (e.g. $1000 → $0.01)
--   • borrower_user_id    — reassign the obligation to a different user
--   • group_id            — detach the debt from its group
--
-- Full exploit chain:
--   1. Borrower sends UPDATE SET status='accepted', amount_cents=1,
--      creator_id=<own uuid>
--   2. USING passes  (old row: pending, non-creator participant)
--   3. Old WITH CHECK passes (status='accepted')
--   4. Borrower is now the creator; calls "creator manual paid update"
--   5. Original $1 000 obligation is permanently erased
--
-- Fix
-- ---
-- Add SECURITY DEFINER helper debt_accept_reject_is_valid() that reads
-- the stored (OLD) row and verifies every column except status and
-- updated_at is unchanged.  Follows the nudge_recipient_can_update
-- pattern from 20260606000009_fix_security_review_policies.sql.
-- =============================================================


-- ── 1. SECURITY DEFINER helper ────────────────────────────────
-- Receives the NEW row's column values from the WITH CHECK context.
-- Reads the pre-update (OLD) row bypassing RLS, then confirms every
-- immutable column is identical to what is stored.
-- updated_at is excluded: the set_updated_at BEFORE trigger rewrites
-- it to now() before WITH CHECK fires, so it always differs.

create or replace function public.debt_accept_reject_is_valid(
  p_id                       uuid,
  p_creator_id               uuid,
  p_payer_user_id            uuid,
  p_payer_contact_id         uuid,
  p_borrower_user_id         uuid,
  p_borrower_contact_id      uuid,
  p_amount_cents             integer,
  p_currency                 text,
  p_description              text,
  p_group_id                 uuid,
  p_due_date                 date,
  p_paid_cents               integer,
  p_paid_at                  timestamptz,
  p_manually_paid            boolean,
  p_pre_paid_status          text,
  p_pre_paid_remaining_cents integer,
  p_client_request_id        text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.debts
    where id                       = p_id
      and creator_id               = p_creator_id
      and payer_user_id            is not distinct from p_payer_user_id
      and payer_contact_id         is not distinct from p_payer_contact_id
      and borrower_user_id         is not distinct from p_borrower_user_id
      and borrower_contact_id      is not distinct from p_borrower_contact_id
      and amount_cents             = p_amount_cents
      and currency                 = p_currency
      and description              is not distinct from p_description
      and group_id                 is not distinct from p_group_id
      and due_date                 is not distinct from p_due_date
      and paid_cents               = p_paid_cents
      and paid_at                  is not distinct from p_paid_at
      and manually_paid            = p_manually_paid
      and pre_paid_status          is not distinct from p_pre_paid_status
      and pre_paid_remaining_cents is not distinct from p_pre_paid_remaining_cents
      and client_request_id        = p_client_request_id
  );
$$;

grant execute on function public.debt_accept_reject_is_valid(
  uuid, uuid, uuid, uuid, uuid, uuid,
  integer, text, text, uuid, date,
  integer, timestamptz, boolean, text, integer, text
) to authenticated;


-- ── 2. Replace the policy ─────────────────────────────────────

drop policy if exists "debts: participant accept or reject" on public.debts;

create policy "debts: participant accept or reject"
  on public.debts for update
  using (
    creator_id        <> auth.uid()
    and (payer_user_id = auth.uid() or borrower_user_id = auth.uid())
    and status = 'pending'
  )
  with check (
    status in ('accepted', 'rejected')
    and public.debt_accept_reject_is_valid(
      id,
      creator_id,
      payer_user_id,
      payer_contact_id,
      borrower_user_id,
      borrower_contact_id,
      amount_cents,
      currency,
      description,
      group_id,
      due_date,
      paid_cents,
      paid_at,
      manually_paid,
      pre_paid_status,
      pre_paid_remaining_cents,
      client_request_id
    )
  );
