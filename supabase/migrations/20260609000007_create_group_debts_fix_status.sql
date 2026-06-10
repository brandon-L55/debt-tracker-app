-- Security fix: create_group_debts() accepted a caller-controlled "status"
-- field from the p_debts JSONB array.  Any authenticated group member could
-- pass status='accepted' or status='paid' and bypass the pending→accepted
-- lifecycle for debts that involve real app users.
--
-- Root cause: the original RPC cast v_item->>'status' directly to debt_status
-- and inserted it verbatim.  No validation was applied.
--
-- Intended behaviour (confirmed in add-group-debt.tsx line 88):
--   linked_user_id IS NULL  → 'accepted'  (manual contact; no app account to approve)
--   linked_user_id IS NOT NULL → 'pending' (app user; other party must approve)
--
-- Fix: drop the status field from the JSONB contract.  Derive status inside
-- the function from linked_user_id, which is already required for the INSERT.
-- The client-side status key is silently ignored if still present in the JSON.

create or replace function public.create_group_debts(
  p_group_id    uuid,
  p_description text,
  p_due_date    text,
  p_direction   text,
  p_debts       jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
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
begin
  if v_creator_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_debts is null or jsonb_array_length(p_debts) = 0 then
    raise exception 'No debt members provided';
  end if;

  -- Group membership guard (added in 20260607000004).
  if p_group_id is not null then
    if not public.is_group_owner_or_member(p_group_id, v_creator_id) then
      raise exception 'Not a member of this group';
    end if;
  end if;

  v_due_date := nullif(p_due_date, '')::date;

  for v_item in select * from jsonb_array_elements(p_debts) loop
    v_contact_id   := (v_item->>'contact_id')::uuid;
    v_linked_uid   := nullif(v_item->>'linked_user_id', '')::uuid;
    v_amount_cents := (v_item->>'amount_cents')::integer;
    v_req_id       := v_item->>'client_request_id';

    if v_contact_id is null then
      raise exception 'contact_id is required for every debt member';
    end if;

    -- Status is derived from whether the counterpart has an app account.
    -- The caller cannot influence this decision through the JSON payload.
    v_status := case
      when v_linked_uid is null then 'accepted'::public.debt_status
      else                           'pending'::public.debt_status
    end;

    if p_direction = 'them' then
      insert into public.debts (
        creator_id, group_id, description, due_date,
        amount_cents, status, client_request_id,
        payer_user_id,
        borrower_contact_id, borrower_user_id
      ) values (
        v_creator_id, p_group_id, p_description, v_due_date,
        v_amount_cents, v_status, v_req_id,
        v_creator_id,
        v_contact_id, v_linked_uid
      )
      returning id into v_new_id;
    else
      insert into public.debts (
        creator_id, group_id, description, due_date,
        amount_cents, status, client_request_id,
        borrower_user_id,
        payer_contact_id, payer_user_id
      ) values (
        v_creator_id, p_group_id, p_description, v_due_date,
        v_amount_cents, v_status, v_req_id,
        v_creator_id,
        v_contact_id, v_linked_uid
      )
      returning id into v_new_id;
    end if;

    v_ids := array_append(v_ids, v_new_id);
  end loop;

  return jsonb_build_object('ids', v_ids);
end;
$$;

grant execute on function public.create_group_debts(uuid, text, text, text, jsonb) to authenticated;
