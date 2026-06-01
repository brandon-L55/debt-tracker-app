-- =============================================================
-- Add paid_at timestamp to debts
--
-- 1. Add paid_at column (nullable TIMESTAMPTZ).
-- 2. Update the after_payment_insert trigger to stamp paid_at
--    when a debt transitions to 'paid' via a payment.
-- =============================================================

-- ─── 1. Column ───────────────────────────────────────────────
alter table public.debts
  add column if not exists paid_at timestamptz;


-- ─── 2. Updated trigger function ─────────────────────────────
-- Replaces the function from 20260524000000_partial_payments.sql.
-- Only change: also sets paid_at = now() when status flips to 'paid'.
create or replace function public.after_payment_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_amount_cents integer;
  v_paid_cents   integer;
  v_new_status   public.debt_status;
begin
  -- Fetch the original debt amount.
  select amount_cents into v_amount_cents
    from public.debts where id = NEW.debt_id;

  -- Sum every payment row for this debt (including the new one).
  select coalesce(sum(amount_cents), 0) into v_paid_cents
    from public.payments where debt_id = NEW.debt_id;

  -- Determine new status.
  if v_paid_cents >= v_amount_cents then
    v_new_status := 'paid';
  else
    v_new_status := 'partial';
  end if;

  -- Update the debt row atomically.
  -- paid_at is only stamped when status first reaches 'paid'; partial stays null.
  update public.debts
     set paid_cents = v_paid_cents,
         status     = v_new_status,
         paid_at    = case when v_new_status = 'paid' then now() else paid_at end
   where id = NEW.debt_id;

  return NEW;
end;
$$;
