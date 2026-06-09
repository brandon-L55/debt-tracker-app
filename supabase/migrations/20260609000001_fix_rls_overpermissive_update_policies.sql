-- =============================================================
-- Fix: Overpermissive debt UPDATE policies
--
-- Two pre-existing issues allow RLS bypass via permissive-policy
-- cross-combination (USING from one policy + WITH CHECK from another).
--
-- Root cause A — "debts: recipient update status" (orphaned, not in
--   any migration file; was created directly in the database).
--   Its WITH CHECK only checks creator_id <> auth.uid() and participant
--   membership — no column or value constraints at all.
--   Any non-creator participant could update ANY column to ANY value
--   by satisfying this policy's WITH CHECK instead of the strict
--   "debts: participant accept or reject" WITH CHECK.
--   This policy is fully redundant with "debts: participant accept or
--   reject" and must be dropped.
--
-- Root cause B — "debts: creator undo manual paid update" WITH CHECK
--   only constrains manually_paid = false.  In permissive RLS a creator
--   can combine:
--     USING from "debts: creator pending update"  (status=pending, paid_cents=0)
--     WITH CHECK from "debts: creator undo manual paid update" (manually_paid=false)
--   to accept their own pending debt — self-approval that should be
--   impossible.  Fix: add a SECURITY DEFINER helper that reads the OLD
--   row and verifies it was status='paid' AND manually_paid=true before
--   approving the new row.
-- =============================================================


-- ── Fix A: Drop the orphaned policy ──────────────────────────
drop policy if exists "debts: recipient update status" on public.debts;


-- ── Fix B: SECURITY DEFINER helper ───────────────────────────
-- Reads the pre-update (OLD) row bypassing RLS.
-- Returns true only when the stored row is in the valid start-state for
-- an undo-manual-paid operation: status='paid' AND manually_paid=true.
-- updated_at is excluded (set_updated_at trigger rewrites it before
-- WITH CHECK fires, so it always differs from the stored value).

create or replace function public.debt_undo_manual_paid_is_valid(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.debts
    where id            = p_id
      and status        = 'paid'
      and manually_paid = true
  );
$$;

grant execute on function public.debt_undo_manual_paid_is_valid(uuid) to authenticated;


-- ── Fix B: Replace the undo policy ───────────────────────────

drop policy if exists "debts: creator undo manual paid update" on public.debts;

create policy "debts: creator undo manual paid update"
  on public.debts for update
  using (
    creator_id    = auth.uid()
    and status        = 'paid'
    and manually_paid = true
  )
  with check (
    creator_id   = auth.uid()
    and manually_paid = false
    and public.debt_undo_manual_paid_is_valid(id)
  );
