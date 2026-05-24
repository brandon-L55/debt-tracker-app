-- =============================================================
-- Borrower-only payment inserts
--
-- Only the debtor/borrower can create payments, and only while the debt
-- is active for payment settlement.
-- =============================================================

drop policy if exists "payments: debt participant insert" on public.payments;
drop policy if exists "payments: debt creator insert" on public.payments;

create policy "payments: borrower insert"
  on public.payments for insert
  with check (
    payer_user_id = auth.uid()
    and exists (
      select 1 from public.debts d
       where d.id = debt_id
         and d.borrower_user_id = auth.uid()
         and d.status in ('accepted', 'partial')
    )
  );
