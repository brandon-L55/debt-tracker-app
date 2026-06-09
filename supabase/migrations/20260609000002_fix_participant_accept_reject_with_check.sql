-- =============================================================
-- Fix: "debts: participant accept or reject" WITH CHECK missing
--   creator_id <> auth.uid() guard
--
-- Root cause
-- ----------
-- The WITH CHECK added in 20260609000000 does not include
-- `creator_id <> auth.uid()`.  In permissive RLS a debt creator can:
--   USING  — "debts: creator pending update" (status=pending, paid_cents=0)
--   WITH CHECK — "debts: participant accept or reject":
--     status in ('accepted', 'rejected') → true
--     debt_accept_reject_is_valid(...) → true (Alice changed no columns,
--       so every stored value matches the new-row values)
-- Result: creator self-accepts their own debt, bypassing the intent
-- of the USING restriction `creator_id <> auth.uid()`.
--
-- Fix
-- ---
-- Add `creator_id <> auth.uid()` to the WITH CHECK.  Because
-- debt_accept_reject_is_valid guarantees creator_id is unchanged from
-- the stored value, this check is equivalent to "the executor is not
-- the creator" and correctly blocks self-approval regardless of which
-- USING policy admits the old row.
-- =============================================================

drop policy if exists "debts: participant accept or reject" on public.debts;

create policy "debts: participant accept or reject"
  on public.debts for update
  using (
    creator_id        <> auth.uid()
    and (payer_user_id = auth.uid() or borrower_user_id = auth.uid())
    and status = 'pending'
  )
  with check (
    creator_id <> auth.uid()
    and status in ('accepted', 'rejected')
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
