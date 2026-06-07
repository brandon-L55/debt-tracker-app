-- =============================================================
-- Payments: denormalize lender_user_id for filtered realtime
--
-- Problem
-- -------
-- The payment subscription in DebtContext subscribed to ALL payment
-- inserts globally (no filter) and then checked client-side whether
-- the payment touched a loaded debt. Every user receives every payment
-- change event, which does not scale.
--
-- Fix
-- ---
-- Add lender_user_id (= debts.payer_user_id, the person being paid)
-- as a denormalized column on payments. This allows two narrow
-- server-side filters in the realtime subscription:
--
--   borrower: payer_user_id=eq.<uid>   — I made a payment
--   lender:   lender_user_id=eq.<uid>  — I was paid
--
-- The column is populated automatically by a BEFORE INSERT trigger so
-- application code (createPayment) requires no changes.
--
-- Depends on nothing — can run standalone.
-- =============================================================

-- 1. Add the column
alter table public.payments
  add column if not exists lender_user_id uuid references auth.users(id) on delete set null;

-- 2. Backfill existing rows from the related debt
update public.payments p
   set lender_user_id = d.payer_user_id
  from public.debts d
 where d.id = p.debt_id
   and p.lender_user_id is null;

-- 3. Index for realtime filter and direct queries
create index if not exists payments_lender_user_id_idx
  on public.payments(lender_user_id)
  where lender_user_id is not null;

-- 4. BEFORE INSERT trigger: auto-populate lender_user_id from the debt
--    so callers never need to pass it explicitly.
create or replace function public.before_payment_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Copy debts.payer_user_id (the lender) into the payment row so
  -- realtime subscriptions can filter by lender_user_id without joining.
  select payer_user_id
    into NEW.lender_user_id
    from public.debts
   where id = NEW.debt_id;
  return NEW;
end;
$$;

drop trigger if exists trg_before_payment_insert on public.payments;

create trigger trg_before_payment_insert
  before insert on public.payments
  for each row execute function public.before_payment_insert();
