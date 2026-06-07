-- =============================================================
-- create_mirror_contact() — v2: auth-derived identity + debt gate
--
-- Security fixes (finding #7):
--
--   1. p_creator_email is now ignored internally.
--      The caller's real email and display name are derived from
--      public.profiles using auth.uid() so the client cannot inject
--      an arbitrary email string into another user's contact book.
--
--   2. A debt relationship gate is added.  The function now requires
--      that a debt row exists where:
--        creator_id    = auth.uid()
--        AND (payer_user_id = p_recipient_user_id
--             OR borrower_user_id = p_recipient_user_id)
--      If no such debt exists the function returns silently.
--      This prevents any authenticated user from writing a contact
--      into an unrelated user's address book simply by knowing their UUID.
--
--   3. The idempotency guard is changed from an email match to a
--      linked_user_id match.  This is more precise (survives email
--      changes on either side) and consistent with how the Individuals
--      tab identifies linked contacts.
--
-- Signature is backward compatible: p_creator_email is still accepted
-- so debtService.ts requires no changes, but it is not used internally.
-- =============================================================

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
  -- Must be an authenticated user who is NOT the recipient.
  if v_uid is null or v_uid = p_recipient_user_id then
    return;
  end if;

  -- Require a real debt relationship: caller must have created a debt
  -- that lists the recipient as payer_user_id or borrower_user_id.
  -- Without this check any authenticated user could insert a contact
  -- into any other user's address book by knowing their UUID.
  if not exists (
    select 1 from public.debts
    where creator_id = v_uid
      and (payer_user_id    = p_recipient_user_id
           or borrower_user_id = p_recipient_user_id)
  ) then
    return;
  end if;

  -- Derive the caller's identity from the database.
  -- p_creator_email is never used — it is caller-supplied and unverified.
  select
    coalesce(nullif(trim(display_name), ''), email),
    email
  into v_creator_name, v_creator_email
  from public.profiles
  where id = v_uid;

  -- Cannot create a useful contact without at least an email identity.
  if v_creator_email is null then
    return;
  end if;

  v_creator_name := coalesce(v_creator_name, v_creator_email);

  -- Idempotent: skip if the recipient already has a contact card linked
  -- to this caller.  Matching on linked_user_id is more precise than an
  -- email match and survives email changes on either account.
  if exists (
    select 1 from public.contacts
    where owner_id      = p_recipient_user_id
      and linked_user_id = v_uid
  ) then
    return;
  end if;

  -- Insert the mirror contact into the recipient's address book.
  -- linked_user_id points back to the caller so the Individuals tab can
  -- show the real-account badge and cross-account debt linking works both ways.
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
