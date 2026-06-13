-- =============================================================
-- Security fix: two confirmed Medium findings in debt/payment integrity
--
-- Finding 1 — "debts: creator insert" status not constrained
--   An authenticated caller could POST directly to /rest/v1/debts
--   with status='accepted' (or 'paid') and any borrower_user_id,
--   bypassing the pending → accepted consent lifecycle.
--
--   Fix: when either counterpart FK (payer_user_id or borrower_user_id)
--   belongs to a different real user, the INSERT policy now requires
--   status = 'pending'.  Manual-contact debts (both counterpart user_id
--   columns null or equal to the creator) may still start as 'accepted'.
--
-- Finding 2 — paid_cents unconstrained in creator UPDATE policies
--   "debts: creator manual paid update" and its undo counterpart had no
--   constraint on paid_cents in their WITH CHECK expressions.  A creator
--   could set paid_cents = 0 via direct PATCH on undo, erasing the
--   borrower's partial-payment progress.  If the borrower then paid
--   again for the full amount, before_payment_insert saw v_remaining =
--   amount_cents (instead of the true remainder), allowed the payment,
--   and after_payment_insert summed existing + new rows into
--   paid_cents > amount_cents (bypassing the overpayment ceiling).
--
--   Fix A: pin mark-paid WITH CHECK to paid_cents = amount_cents.
--   Fix B: pin undo    WITH CHECK to paid_cents = debt_payments_sum(id),
--          a new SECURITY DEFINER helper that reads the authoritative
--          sum from the payments table rather than trusting the caller.
--   Fix C: add a table-level CHECK (NOT VALID) as defence-in-depth.
--          NOT VALID = new writes enforced immediately; existing rows
--          are not scanned.  Validate with:
--            ALTER TABLE public.debts
--              VALIDATE CONSTRAINT debts_paid_cents_bounds;
--          after confirming:
--            SELECT id, amount_cents, paid_cents FROM public.debts
--            WHERE paid_cents < 0 OR paid_cents > amount_cents;
--          returns 0 rows.
-- =============================================================


-- ══════════════════════════════════════════════════════════════
-- Finding 1: Replace "debts: creator insert"
-- ══════════════════════════════════════════════════════════════

drop policy if exists "debts: creator insert" on public.debts;

create policy "debts: creator insert"
  on public.debts for insert
  with check (
    creator_id = auth.uid()
    -- When a real counterpart user is listed on the other side, the
    -- debt must start as 'pending' so the counterpart must consent.
    -- Manual-contact debts (no counterpart user_id) may start as
    -- 'accepted' — contacts have no account and cannot respond.
    and (
      case
        when (payer_user_id    is not null and payer_user_id    <> auth.uid())
          or (borrower_user_id is not null and borrower_user_id <> auth.uid())
        then status = 'pending'
        else status in ('pending', 'accepted')
      end
    )
    and (
      group_id is null
      or public.is_group_owner_or_member(group_id, auth.uid())
    )
  );


-- ══════════════════════════════════════════════════════════════
-- Finding 2-A: SECURITY DEFINER helper — authoritative paid_cents
-- ══════════════════════════════════════════════════════════════
-- Returns the sum of all payment rows for a debt.  Called from the
-- undo policy WITH CHECK to pin paid_cents to the payments table
-- rather than a caller-supplied value.
-- SECURITY DEFINER: reads payments bypassing RLS so the policy
-- expression can call it without a recursive-policy problem.

create or replace function public.debt_payments_sum(p_debt_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(amount_cents), 0)::integer
    from public.payments
   where debt_id = p_debt_id;
$$;

revoke execute on function public.debt_payments_sum(uuid) from public, anon;
grant  execute on function public.debt_payments_sum(uuid) to authenticated;


-- ══════════════════════════════════════════════════════════════
-- Finding 2-B: Replace "debts: creator manual paid update"
-- ══════════════════════════════════════════════════════════════
-- Adds paid_cents = amount_cents to WITH CHECK.
-- markDebtManuallyPaid() already sends amount_cents as paid_cents;
-- this policy now enforces it so a direct PATCH cannot differ.

drop policy if exists "debts: creator manual paid update" on public.debts;

create policy "debts: creator manual paid update"
  on public.debts for update
  using (
    creator_id = auth.uid()
    and status in ('accepted', 'partial')
  )
  with check (
    creator_id    = auth.uid()
    and status        = 'paid'
    and manually_paid = true
    and paid_cents    = amount_cents
  );


-- ══════════════════════════════════════════════════════════════
-- Finding 2-C: Replace "debts: creator undo manual paid update"
-- ══════════════════════════════════════════════════════════════
-- Adds paid_cents = debt_payments_sum(id) to WITH CHECK.
-- Proof that app code still passes:
--   undoManualPaid() sends paid_cents = amount_cents - pre_paid_remaining_cents.
--   pre_paid_remaining_cents was stored by markDebtManuallyPaid() as
--   amount_cents - paid_cents_at_time_of_mark.
--   paid_cents_at_time_of_mark = sum(payments) (set by after_payment_insert).
--   No payments can be made while status='paid', so sum(payments) is
--   unchanged between mark and undo.
--   Therefore: amount_cents - pre_paid_remaining_cents
--             = amount_cents - (amount_cents - sum(payments))
--             = sum(payments)
--             = debt_payments_sum(id).  ✓

drop policy if exists "debts: creator undo manual paid update" on public.debts;

create policy "debts: creator undo manual paid update"
  on public.debts for update
  using (
    creator_id    = auth.uid()
    and status        = 'paid'
    and manually_paid = true
  )
  with check (
    creator_id    = auth.uid()
    and manually_paid = false
    and public.debt_undo_manual_paid_is_valid(id, status)
    and paid_cents = public.debt_payments_sum(id)
  );


-- ══════════════════════════════════════════════════════════════
-- Finding 2-D: Defence-in-depth table CHECK (NOT VALID)
-- ══════════════════════════════════════════════════════════════

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.debts'::regclass
      and conname  = 'debts_paid_cents_bounds'
  ) then
    alter table public.debts
      add constraint debts_paid_cents_bounds
      check (paid_cents >= 0 and paid_cents <= amount_cents)
      not valid;
  end if;
end $$;
