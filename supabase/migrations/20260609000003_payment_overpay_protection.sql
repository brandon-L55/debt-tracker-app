-- =============================================================
-- Fix L-2: DB-level overpayment protection with row-level locking
--
-- Root cause
-- ----------
-- The "payments: borrower insert" RLS policy checks that the debt is in
-- 'accepted' or 'partial' status but has no ceiling on the payment amount.
-- Even with a ceiling in the RLS policy, two concurrent payment inserts
-- can both read the same paid_cents value, both individually pass the
-- ceiling check, and together overpay the debt (classic TOCTOU race).
--
-- Fix
-- ---
-- Extend the existing before_payment_insert() BEFORE INSERT trigger
-- (added in 20260607000002) to:
--   1. Acquire an exclusive row lock on the debt via SELECT … FOR UPDATE.
--      Any concurrent transaction inserting a payment for the same debt
--      blocks here until the first transaction commits (at which point
--      after_payment_insert() has already updated paid_cents).  The
--      second transaction then sees the updated balance and correctly
--      fails if no headroom remains.
--   2. Enforce amount_cents > 0 and amount_cents ≤ remaining balance.
--   3. Continue to denormalize lender_user_id (same SELECT, no extra
--      round-trip).
--
-- The trigger itself (trg_before_payment_insert) already exists —
-- only the function body is replaced here.
-- =============================================================

create or replace function public.before_payment_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_amount_cents  integer;
  v_paid_cents    integer;
  v_payer_user_id uuid;
  v_remaining     integer;
begin
  -- Single query: lock the debt row to serialize concurrent inserts and
  -- retrieve the columns needed for both the ceiling check and the
  -- lender_user_id denormalization.
  select amount_cents, paid_cents, payer_user_id
    into v_amount_cents, v_paid_cents, v_payer_user_id
    from public.debts
   where id = NEW.debt_id
   for update;

  if not found then
    raise exception 'Debt % not found', NEW.debt_id;
  end if;

  -- Ceiling check: reject zero/negative amounts and overpayments.
  if NEW.amount_cents <= 0 then
    raise exception 'Payment amount_cents must be positive (got %)', NEW.amount_cents;
  end if;

  v_remaining := v_amount_cents - v_paid_cents;

  if NEW.amount_cents > v_remaining then
    raise exception
      'Payment of % cents exceeds remaining balance of % cents on debt %',
      NEW.amount_cents, v_remaining, NEW.debt_id;
  end if;

  -- Denormalize lender_user_id for realtime subscription filtering
  -- (preserves behaviour from 20260607000002_payments_lender_user_id).
  NEW.lender_user_id := v_payer_user_id;

  return NEW;
end;
$$;
