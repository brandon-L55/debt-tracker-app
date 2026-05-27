-- =============================================================
-- Pending debt edit/cancel RLS
--
-- Creators may edit or cancel only pending debts.  Accepted/partial
-- debts are protected from accidental hard-delete, especially once
-- payment history exists.
-- =============================================================

drop policy if exists "debts: creator update" on public.debts;
drop policy if exists "debts: creator delete" on public.debts;

create policy "debts: creator pending update"
  on public.debts for update
  using (
    creator_id = auth.uid()
    and status = 'pending'
    and paid_cents = 0
  )
  with check (
    creator_id = auth.uid()
    and status in ('pending', 'rejected')
    and paid_cents = 0
  );

create policy "debts: creator safe delete"
  on public.debts for delete
  using (
    creator_id = auth.uid()
    and status in ('pending', 'rejected')
    and paid_cents = 0
  );
