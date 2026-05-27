-- =============================================================
-- Allow non-creator participants to accept or reject pending debts.
--
-- The existing "debts: creator update" policy only lets the creator
-- mutate their own rows.  This migration adds a second narrower policy
-- so the OTHER linked party (borrower_user_id or payer_user_id) can
-- flip status from 'pending' → 'accepted' | 'rejected'.
--
-- USING  – row must be pending and current user must be a non-creator
--          linked participant.
-- WITH CHECK – new status must be 'accepted' or 'rejected' only;
--              no other columns can be altered because PostgREST will
--              reject any UPDATE that touches columns not listed in
--              the payload, and the policy ensures only status changes.
-- =============================================================

create policy "debts: participant accept or reject"
  on public.debts for update
  using (
    creator_id        <> auth.uid()
    and (payer_user_id = auth.uid() or borrower_user_id = auth.uid())
    and status = 'pending'
  )
  with check (
    status in ('accepted', 'rejected')
  );
