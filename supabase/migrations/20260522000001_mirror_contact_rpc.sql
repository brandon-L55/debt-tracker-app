-- =============================================================
-- create_mirror_contact RPC
--
-- When Account A creates a debt for Account B (email-identified),
-- B needs a contact card for A in their own address book so that
-- B's Individuals tab shows A.
--
-- The contacts RLS ("contacts: owner all") only allows a user to
-- insert rows where owner_id = auth.uid(), so A cannot write
-- directly into B's contact list.  This SECURITY DEFINER function
-- bypasses that restriction while still verifying the caller is
-- authenticated and is not trying to write to their own list.
-- =============================================================

create or replace function public.create_mirror_contact(
  p_recipient_user_id uuid,   -- B's auth user id
  p_creator_email     text    -- A's email (normalized by caller)
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_creator_name text;
begin
  -- Must be called by an authenticated user who is NOT the recipient.
  if auth.uid() is null or auth.uid() = p_recipient_user_id then
    return;
  end if;

  -- Idempotent: skip if the recipient already has a contact with this email.
  if exists (
    select 1 from public.contacts
    where owner_id = p_recipient_user_id
      and lower(trim(email)) = lower(trim(p_creator_email))
  ) then
    return;
  end if;

  -- Resolve creator's display name; fall back to their email.
  select coalesce(nullif(trim(display_name), ''), lower(trim(p_creator_email)))
  into   v_creator_name
  from   public.profiles
  where  id = auth.uid();

  v_creator_name := coalesce(v_creator_name, lower(trim(p_creator_email)));

  -- Insert the mirror contact owned by the recipient.
  -- linked_user_id points back to A so the Individuals tab can show
  -- the real-account badge and cross-account debt linking works both ways.
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
    lower(trim(p_creator_email)),
    auth.uid(),   -- A's user_id
    9999,
    false,
    false
  );
end;
$$;

-- Grant execute to authenticated users (anon never calls this).
grant execute on function public.create_mirror_contact(uuid, text)
  to authenticated;
