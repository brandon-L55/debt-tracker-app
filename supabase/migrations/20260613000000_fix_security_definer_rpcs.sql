-- =============================================================
-- Security: patch three confirmed SECURITY DEFINER vulnerabilities
--
-- Fix 1 — resolve_login_identifier (HIGH)
--   The username-match path returned the real auth email to any
--   unauthenticated (anon) caller.  Only the phone-match path had
--   the synthetic-email filter applied.  Fix: apply the filter
--   unconditionally — all lookup paths (phone AND username) now
--   only return synthetic emails.  Users with email-based accounts
--   must log in by entering their email directly; the client already
--   handles a null return as "account not found."
--
-- Fix 2 — create_mirror_contact (MEDIUM)
--   The debt-relationship gate accepted status <> 'rejected', which
--   included 'pending'.  An attacker could create a pending debt
--   targeting any user (whose UUID they knew) and immediately call
--   this SECURITY DEFINER function to inject a contact card into
--   the victim's address book before the victim had consented to
--   the debt.  Fix: gate now requires status IN
--   ('accepted', 'partial', 'paid') — an active relationship.
--   App impact: DebtContext.tsx now fires the RPC on the accepted
--   realtime event instead of at debt-creation time.
--
-- Fix 3 — create_group_debts (MEDIUM)
--   The function accepted caller-supplied contact_id values from
--   the p_debts JSONB array without verifying that the contact
--   belongs to the calling user.  Because SECURITY DEFINER bypasses
--   RLS, a caller who knew a valid contact UUID owned by another
--   user could create debt rows with that foreign contact_id.
--   Fix: explicit ownership check before each INSERT.
-- =============================================================


-- ── Fix 1: resolve_login_identifier ──────────────────────────

create or replace function public.resolve_login_identifier(identifier text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id    uuid;
  v_auth_email text;
  v_clean      text := trim(identifier);
begin
  if v_clean = '' or v_clean is null then
    return null;
  end if;

  -- 1. Exact phone match (client normalizes before calling)
  select id into v_user_id
    from public.profiles
   where phone = v_clean
     and phone is not null and phone <> ''
   limit 1;

  -- 2. Digits-only fallback (handles minor format drift)
  if v_user_id is null then
    select id into v_user_id
      from public.profiles
     where regexp_replace(phone, '[^0-9]', '', 'g')
             = regexp_replace(v_clean, '[^0-9]', '', 'g')
       and phone is not null and phone <> ''
     limit 1;
  end if;

  -- 3. Username (case-insensitive)
  if v_user_id is null then
    select id into v_user_id
      from public.profiles
     where lower(username) = lower(v_clean)
       and username is not null and username <> ''
     limit 1;
  end if;

  if v_user_id is null then
    return null;
  end if;

  select email into v_auth_email
    from auth.users
   where id = v_user_id;

  -- Only return synthetic emails (ph_<digits>@gotchulatr.internal).
  -- Real email addresses are never returned to unauthenticated callers
  -- regardless of whether the match was by phone or username.
  -- Accounts whose auth email is a real address must log in by typing
  -- their email directly; the client treats null as "account not found."
  if v_auth_email not like '%@gotchulatr.internal' then
    return null;
  end if;

  return v_auth_email;
end;
$$;

-- Grant unchanged.
grant execute on function public.resolve_login_identifier(text)
  to anon, authenticated;


-- ── Fix 2: create_mirror_contact ─────────────────────────────

create or replace function public.create_mirror_contact(
  p_recipient_user_id uuid,
  p_creator_email     text    -- accepted for backward compat; ignored internally
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid           uuid := auth.uid();
  v_creator_name  text;
  v_creator_email text;
begin
  if v_uid is null or v_uid = p_recipient_user_id then
    return;
  end if;

  -- Debt gate: an accepted (not merely pending) debt must exist.
  -- Requiring an active status means the recipient has explicitly
  -- approved the debt relationship before the caller can write a
  -- contact card into the recipient's address book.
  -- 'pending' is excluded — a debt request alone is not consent.
  -- 'rejected' debts were already excluded by the previous guard.
  if not exists (
    select 1 from public.debts
    where creator_id = v_uid
      and (payer_user_id    = p_recipient_user_id
           or borrower_user_id = p_recipient_user_id)
      and status in ('accepted', 'partial', 'paid')
  ) then
    return;
  end if;

  select
    coalesce(nullif(trim(display_name), ''), email),
    email
  into v_creator_name, v_creator_email
  from public.profiles
  where id = v_uid;

  if v_creator_email is null then
    return;
  end if;

  v_creator_name := coalesce(v_creator_name, v_creator_email);

  if exists (
    select 1 from public.contacts
    where owner_id       = p_recipient_user_id
      and linked_user_id = v_uid
  ) then
    return;
  end if;

  insert into public.contacts (
    owner_id,
    name,
    email,
    linked_user_id,
    sort_order,
    pinned,
    silenced
  ) values (
    p_recipient_user_id,
    v_creator_name,
    v_creator_email,
    v_uid,
    9999,
    false,
    false
  );
end;
$$;

grant execute on function public.create_mirror_contact(uuid, text)
  to authenticated;


-- ── Fix 3: create_group_debts ─────────────────────────────────

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

    -- Ownership guard: SECURITY DEFINER bypasses RLS on the INSERT, so we
    -- must check contact ownership explicitly.  Reject any contact_id that
    -- does not belong to the calling user to prevent cross-user data
    -- corruption.
    if not exists (
      select 1 from public.contacts
      where id = v_contact_id and owner_id = v_creator_id
    ) then
      raise exception 'contact_id % does not belong to caller', v_contact_id;
    end if;

    -- Status is derived from whether the counterpart has an app account.
    -- The caller cannot influence this decision through the JSON payload
    -- (fixed in 20260609000007).
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
