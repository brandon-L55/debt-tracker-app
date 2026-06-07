-- =============================================================
-- RLS Bug Fixes
--
-- Bug 1: markDebtManuallyPaid and undoManualPaid silently fail
-- ---------------------------------------------------------------
-- Both service functions do UPDATE on debts where status is
-- 'accepted' or 'partial' (or 'paid' for undo).  No existing
-- policy covers these transitions.  Result: the Supabase client
-- call returns no error (UPDATE returns 0 rows silently) but the
-- debt is never marked paid.
--
-- Fix: two new UPDATE policies scoped to the creator only.
--   Policy A — mark paid:   accepted/partial → paid, manually_paid=true
--   Policy B — undo mark:   paid+manually_paid=true → any, manually_paid=false
--
-- Bug 2: debt INSERT does not verify group membership
-- ---------------------------------------------------------------
-- The "debts: creator insert" policy only checks creator_id = auth.uid().
-- A user can insert a debt into any group they know the UUID of,
-- even without being a member.
--
-- Fix:
--   2a. Replace the existing "debts: creator insert" policy to
--       additionally require is_group_owner_or_member() when group_id
--       is not null.
--   2b. Tighten the SECURITY DEFINER create_group_debts() RPC with
--       an explicit membership check, because SECURITY DEFINER bypasses
--       the INSERT policy and the old function had no guard of its own.
-- =============================================================


-- ══════════════════════════════════════════════════════════════
-- Prerequisite columns for Bug 1 policies
-- ══════════════════════════════════════════════════════════════
--
-- The service-layer comment in debtService.ts describes these columns
-- but they may not exist on the remote database yet.  Adding them here
-- (before any policy references them) ensures the migration is safe to
-- run against any environment.  IF NOT EXISTS makes it idempotent.

alter table public.debts
  add column if not exists manually_paid boolean not null default false;

alter table public.debts
  add column if not exists pre_paid_status text;

alter table public.debts
  add column if not exists pre_paid_remaining_cents integer;


-- ══════════════════════════════════════════════════════════════
-- Bug 1-A: creator can mark an accepted/partial debt as paid
-- ══════════════════════════════════════════════════════════════
--
-- markDebtManuallyPaid() updates:
--   status → 'paid', paid_cents → amount_cents, manually_paid → true,
--   pre_paid_status → <old status>, pre_paid_remaining_cents → <int>,
--   paid_at → <timestamp>
--
-- USING  — target row must be creator's, currently active
-- WITH CHECK — new row must be 'paid' with manually_paid = true
--
-- creator_id is immutable so it is safe to test in WITH CHECK.

create policy "debts: creator manual paid update"
  on public.debts for update
  using (
    creator_id = auth.uid()
    and status in ('accepted', 'partial')
  )
  with check (
    creator_id   = auth.uid()
    and status        = 'paid'
    and manually_paid = true
  );


-- ══════════════════════════════════════════════════════════════
-- Bug 1-B: creator can undo a manual paid mark
-- ══════════════════════════════════════════════════════════════
--
-- undoManualPaid() updates:
--   status → pre_paid_status, paid_cents → <restored>, manually_paid → false,
--   pre_paid_status → null, pre_paid_remaining_cents → null, paid_at → null
--
-- WITH CHECK only constrains that manually_paid becomes false; the
-- restored status can be anything that was previously valid (accepted /
-- partial / pending).

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
  );


-- ══════════════════════════════════════════════════════════════
-- Bug 2-A: require group membership on direct debt INSERT
-- ══════════════════════════════════════════════════════════════

drop policy if exists "debts: creator insert" on public.debts;

create policy "debts: creator insert"
  on public.debts for insert
  with check (
    creator_id = auth.uid()
    -- When the debt belongs to a group, the creator must be a member.
    -- is_group_owner_or_member is SECURITY DEFINER (20260521000004)
    -- so it avoids RLS recursion on group_members.
    and (
      group_id is null
      or public.is_group_owner_or_member(group_id, auth.uid())
    )
  );


-- ══════════════════════════════════════════════════════════════
-- Bug 2-B: add group membership guard to create_group_debts RPC
-- ══════════════════════════════════════════════════════════════
--
-- The RPC is SECURITY DEFINER so it bypasses the INSERT policy above.
-- The guard must be inside the function itself.
-- All other behaviour is identical to the previous version.

CREATE OR REPLACE FUNCTION public.create_group_debts(
  p_group_id    uuid,
  p_description text,
  p_due_date    text,
  p_direction   text,
  p_debts       jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_creator_id   uuid := auth.uid();
  v_item         jsonb;
  v_ids          uuid[] := '{}';
  v_new_id       uuid;
  v_contact_id   uuid;
  v_linked_uid   uuid;
  v_amount_cents integer;
  v_status       public.debt_status;
  v_req_id       text;
  v_due_date     date;
BEGIN
  IF v_creator_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_debts IS NULL OR jsonb_array_length(p_debts) = 0 THEN
    RAISE EXCEPTION 'No debt members provided';
  END IF;

  -- Bug 2-B fix: verify group membership before inserting any rows.
  -- Without this check, any authenticated user who knows a group UUID
  -- can call this RPC and create debts inside that group.
  IF p_group_id IS NOT NULL THEN
    IF NOT public.is_group_owner_or_member(p_group_id, v_creator_id) THEN
      RAISE EXCEPTION 'Not a member of this group';
    END IF;
  END IF;

  v_due_date := NULLIF(p_due_date, '')::date;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_debts) LOOP
    v_contact_id   := (v_item->>'contact_id')::uuid;
    v_linked_uid   := NULLIF(v_item->>'linked_user_id', '')::uuid;
    v_amount_cents := (v_item->>'amount_cents')::integer;
    v_status       := (v_item->>'status')::public.debt_status;
    v_req_id       := v_item->>'client_request_id';

    IF v_contact_id IS NULL THEN
      RAISE EXCEPTION 'contact_id is required for every debt member';
    END IF;

    IF p_direction = 'them' THEN
      -- Creator is the lender; the contact is the borrower.
      INSERT INTO public.debts (
        creator_id, group_id, description, due_date,
        amount_cents, status, client_request_id,
        payer_user_id,
        borrower_contact_id, borrower_user_id
      ) VALUES (
        v_creator_id, p_group_id, p_description, v_due_date,
        v_amount_cents, v_status, v_req_id,
        v_creator_id,
        v_contact_id, v_linked_uid
      )
      RETURNING id INTO v_new_id;
    ELSE
      -- Creator is the borrower; the contact is the lender.
      INSERT INTO public.debts (
        creator_id, group_id, description, due_date,
        amount_cents, status, client_request_id,
        borrower_user_id,
        payer_contact_id, payer_user_id
      ) VALUES (
        v_creator_id, p_group_id, p_description, v_due_date,
        v_amount_cents, v_status, v_req_id,
        v_creator_id,
        v_contact_id, v_linked_uid
      )
      RETURNING id INTO v_new_id;
    END IF;

    v_ids := array_append(v_ids, v_new_id);
  END LOOP;

  RETURN jsonb_build_object('ids', v_ids);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_group_debts(uuid, text, text, text, jsonb) TO authenticated;
