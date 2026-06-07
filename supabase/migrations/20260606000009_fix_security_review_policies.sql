-- =============================================================
-- Three remaining moderate policy gaps from the security review
--
--   A. debt_nudges: recipient update — add an explicit WITH CHECK
--      that prevents the recipient from changing any column other
--      than `read`.  A SECURITY DEFINER helper is used to read the
--      stored (OLD) row values inside the policy expression without
--      triggering RLS recursion.
--
--   B. group_debt_cancelling_preferences: INSERT — require that the
--      caller is actually a member of the target group, not just
--      that user_id = auth.uid().  Reuses the existing
--      is_group_owner_or_member() SECURITY DEFINER helper.
--
--   C. create_mirror_contact — filter rejected debts out of the
--      relationship gate so an explicitly declined debt no longer
--      authorises writing a contact into the recipient's address book.
-- =============================================================


-- ══════════════════════════════════════════════════════════════
-- A. debt_nudges: lock immutable columns on recipient UPDATE
-- ══════════════════════════════════════════════════════════════

-- Returns true when every immutable column in the NEW row matches
-- the stored row.  Called from WITH CHECK; the column-name arguments
-- carry NEW values; the function reads OLD values with SECURITY
-- DEFINER (bypasses RLS) and confirms only `read` changed.

create or replace function public.nudge_recipient_can_update(
  p_id                uuid,
  p_sender_user_id    uuid,
  p_recipient_user_id uuid,
  p_amount_cents      integer,
  p_message           text,
  p_contact_id        uuid,
  p_group_id          uuid,
  p_group_name        text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.debt_nudges
    where id                = p_id
      and sender_user_id    = p_sender_user_id
      and recipient_user_id = p_recipient_user_id
      and amount_cents      = p_amount_cents
      and message           = p_message
      and contact_id        is not distinct from p_contact_id
      and group_id          is not distinct from p_group_id
      and group_name        is not distinct from p_group_name
  );
$$;

grant execute on function public.nudge_recipient_can_update(uuid, uuid, uuid, integer, text, uuid, uuid, text)
  to authenticated;

drop policy if exists "debt_nudges: recipient update" on public.debt_nudges;

create policy "debt_nudges: recipient update"
  on public.debt_nudges for update
  using (recipient_user_id = auth.uid())
  with check (
    recipient_user_id = auth.uid()
    and public.nudge_recipient_can_update(
      id,
      sender_user_id,
      recipient_user_id,
      amount_cents,
      message,
      contact_id,
      group_id,
      group_name
    )
  );


-- ══════════════════════════════════════════════════════════════
-- B. group_debt_cancelling_preferences: require group membership on INSERT
-- ══════════════════════════════════════════════════════════════

-- is_group_owner_or_member() already exists from
-- 20260521000004_fix_rls_recursion.sql — no new trust boundary.

drop policy if exists "debt_cancelling_prefs: owner insert"
  on public.group_debt_cancelling_preferences;

create policy "debt_cancelling_prefs: owner insert"
  on public.group_debt_cancelling_preferences for insert
  with check (
    user_id = auth.uid()
    and public.is_group_owner_or_member(group_id, auth.uid())
  );


-- ══════════════════════════════════════════════════════════════
-- C. create_mirror_contact: exclude rejected debts from gate
-- ══════════════════════════════════════════════════════════════
--
-- status <> 'rejected' is the only change from v2.
-- pending / accepted / disputed / partial / paid all remain valid;
-- a pending debt is still a live request from the creator, so mirror
-- contact creation must continue to work during the acceptance flow.

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

  -- Debt gate: caller must have created a non-rejected debt that lists
  -- the recipient as payer_user_id or borrower_user_id.
  -- Rejected status means the recipient explicitly declined the debt;
  -- that should not authorise writing to their contact book.
  if not exists (
    select 1 from public.debts
    where creator_id = v_uid
      and (payer_user_id    = p_recipient_user_id
           or borrower_user_id = p_recipient_user_id)
      and status <> 'rejected'
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
