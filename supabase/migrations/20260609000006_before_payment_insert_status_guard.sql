-- Security fix: before_payment_insert() had no debt-status guard.
--
-- The trigger runs as SECURITY DEFINER, so its FOR UPDATE query bypasses RLS.
-- Any path that inserts into payments (including future service-role callers)
-- could pay a debt that is still pending, already paid, or cancelled — the
-- only protection was the RLS policy, which is ineffective inside the trigger.
--
-- Fix: add status to the existing FOR UPDATE query (no extra round-trip) and
-- raise immediately if the debt is not in a payable state ('accepted'/'partial').

create or replace function public.before_payment_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status        text;
  v_amount_cents  integer;
  v_paid_cents    integer;
  v_payer_user_id uuid;
  v_remaining     integer;
begin
  -- Single query: lock the debt row to serialize concurrent inserts and
  -- retrieve every column needed for the status guard, ceiling check, and
  -- lender_user_id denormalization.
  select status, amount_cents, paid_cents, payer_user_id
    into v_status, v_amount_cents, v_paid_cents, v_payer_user_id
    from public.debts
   where id = NEW.debt_id
   for update;

  if not found then
    raise exception 'Debt % not found', NEW.debt_id;
  end if;

  -- Status guard: debt must be in a payable state.
  if v_status not in ('accepted', 'partial') then
    raise exception
      'Debt % cannot be paid: current status is ''%''',
      NEW.debt_id, v_status;
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
