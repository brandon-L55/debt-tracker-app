-- =============================================================
-- Partial Payments Support
--
-- 1. Add paid_cents to debts (denormalized sum of completed payments).
-- 2. Trigger: after each payment insert, recalculate paid_cents and
--    flip debt status: accepted → partial → paid.
-- 3. Replace the narrow "debt creator insert" payments policy with one
--    that also allows the borrower/payer to record payments, restricted
--    to debts already in 'accepted' or 'partial' state.
-- =============================================================

-- ─── 1. paid_cents column ────────────────────────────────────
alter table public.debts
  add column if not exists paid_cents integer not null default 0;


-- ─── 2. Trigger function ─────────────────────────────────────
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
  update public.debts
     set paid_cents = v_paid_cents,
         status     = v_new_status
   where id = NEW.debt_id;

  return NEW;
end;
$$;

create trigger trg_after_payment_insert
  after insert on public.payments
  for each row execute function public.after_payment_insert();


-- ─── 3. Payments RLS ─────────────────────────────────────────
-- Drop the old policy that only allowed the debt creator.
drop policy if exists "payments: debt creator insert" on public.payments;

-- New policy: any involved party (creator, payer, or borrower) may
-- record a payment, but only while the debt is active (accepted/partial).
create policy "payments: debt participant insert"
  on public.payments for insert
  with check (
    exists (
      select 1 from public.debts d
       where d.id = debt_id
         and (
               d.creator_id          = auth.uid()
            or d.payer_user_id       = auth.uid()
            or d.borrower_user_id    = auth.uid()
         )
         and d.status in ('accepted', 'partial')
    )
  );
