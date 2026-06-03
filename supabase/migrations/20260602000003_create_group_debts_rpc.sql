-- Atomic group debt creation RPC.
--
-- Creates all per-member debt rows in a single PostgreSQL transaction.
-- If any INSERT fails (constraint violation, auth error, etc.) the whole
-- transaction rolls back automatically — no partial group debts are left.
--
-- Parameters:
--   p_group_id    – group the debts belong to (nullable for ungrouped use)
--   p_description – shared reason/description for all rows
--   p_due_date    – ISO date string ("YYYY-MM-DD") or null
--   p_direction   – "them" (they owe creator) or "me" (creator owes them)
--   p_debts       – JSON array, each element:
--                     { contact_id, linked_user_id, amount_cents,
--                       status, client_request_id }
--
-- Returns: { "ids": ["uuid", ...] }

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
