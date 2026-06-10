-- Security fix: "debts: creator undo manual paid update" WITH CHECK only
-- enforced manually_paid = false.  It placed no constraint on status, so a
-- creator could flip a paid/manually_paid debt to any status (e.g. 'pending'
-- to force the borrower to re-approve their own debt).
--
-- Fix: extend the SECURITY DEFINER helper to accept the proposed new status
-- and verify it equals the stored pre_paid_status.  Status can therefore only
-- revert to exactly what it was before the manual-paid mark was applied.


-- ── 1. Drop old policy (references the old 1-argument helper) ────────────

drop policy if exists "debts: creator undo manual paid update" on public.debts;


-- ── 2. Replace the helper with a 2-argument version ─────────────────────
--      (old 1-arg function is left intact for the one turn between migration
--       application and the policy being recreated below; dropping it first
--       would cause a dependency error if Postgres checks at parse time)

drop function if exists public.debt_undo_manual_paid_is_valid(uuid);

create or replace function public.debt_undo_manual_paid_is_valid(
  p_id         uuid,
  p_new_status debt_status    -- matches the debt.status column type
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.debts
    where id              = p_id
      and status          = 'paid'
      and manually_paid   = true
      -- pre_paid_status is text; cast the enum so comparison is type-safe
      and pre_paid_status = p_new_status::text
  );
$$;

-- Deny anonymous callers; authenticated-only (PUBLIC already revoked in 00004)
revoke execute on function public.debt_undo_manual_paid_is_valid(uuid, debt_status) from public;
grant  execute on function public.debt_undo_manual_paid_is_valid(uuid, debt_status) to authenticated;


-- ── 3. Recreate the policy with status pinned ────────────────────────────

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
    -- passes the NEW status into the helper; helper confirms it matches
    -- the pre_paid_status captured when the debt was marked paid
    and public.debt_undo_manual_paid_is_valid(id, status)
  );
