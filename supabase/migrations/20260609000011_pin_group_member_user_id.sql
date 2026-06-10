-- Security fix: group_members INSERT and UPDATE policies allowed the group
-- owner to write any authenticated user's UUID as user_id.
--
-- The first pass pinned group_members.user_id to contacts.linked_user_id, but
-- contacts owners can write their own contacts rows.  That moved the trust
-- problem instead of removing it: a malicious owner could set
-- contacts.linked_user_id to an arbitrary UUID, then use that contact to enroll
-- the victim in a group.
--
-- Root fix:
--   1. Guard contacts.linked_user_id at the table boundary.
--   2. Keep group_members.user_id pinned to the caller-owned contact.
--
-- Preserved trusted linking paths:
--   - claim_invited_contacts(): invited_email must match the claimed profile.
--   - create_mirror_contact(): email must match the caller profile.
--   - App contact creation: email, phone, or username must match the linked
--     profile that search/find RPCs resolved.
--   - Accepted friend requests: accepting a request may create a contact from
--     the already-approved relationship even without a copied identifier.


-- ---------------------------------------------------------------------------
-- A. contacts.linked_user_id provenance guard
-- ---------------------------------------------------------------------------

create or replace function public.contact_link_matches_profile(
  p_linked_user_id uuid,
  p_email          text,
  p_phone          text,
  p_username       text,
  p_invited_email  text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_linked_user_id is null
    or exists (
      select 1
      from public.profiles p
      where p.id = p_linked_user_id
        and (
          (
            p_email is not null
            and p.email is not null
            and lower(trim(p.email)) = lower(trim(p_email))
          )
          or (
            p_invited_email is not null
            and p.email is not null
            and lower(trim(p.email)) = lower(trim(p_invited_email))
          )
          or (
            p_username is not null
            and p.username is not null
            and p.username <> ''
            and lower(trim(p.username)) = lower(ltrim(trim(p_username), '@'))
          )
          or (
            p_phone is not null
            and p.phone is not null
            and p.phone <> ''
            and (
              trim(p.phone) = trim(p_phone)
              or (
                regexp_replace(p.phone, '[^0-9]', '', 'g') <> ''
                and regexp_replace(p.phone, '[^0-9]', '', 'g')
                  = regexp_replace(p_phone, '[^0-9]', '', 'g')
              )
            )
          )
        )
    )
    or exists (
      select 1
      from public.friend_requests fr
      where fr.status = 'accepted'
        and (
          (fr.sender_user_id = auth.uid() and fr.recipient_user_id = p_linked_user_id)
          or
          (fr.recipient_user_id = auth.uid() and fr.sender_user_id = p_linked_user_id)
        )
    );
$$;

revoke execute on function public.contact_link_matches_profile(uuid, text, text, text, text)
  from public, anon, authenticated;

create or replace function public.enforce_contact_linked_user_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Clearing a link is allowed.  Setting a non-null link requires that the
  -- contact row carries an identifier that actually belongs to that profile.
  if new.linked_user_id is not null
     and not public.contact_link_matches_profile(
       new.linked_user_id,
       new.email,
       new.phone,
       new.username,
       new.invited_email
     ) then
    raise exception 'contacts.linked_user_id must match the linked profile identifier'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke execute on function public.enforce_contact_linked_user_id()
  from public, anon, authenticated;

drop trigger if exists trg_enforce_contact_linked_user_id on public.contacts;

create trigger trg_enforce_contact_linked_user_id
  before insert or update of linked_user_id, email, phone, username, invited_email
  on public.contacts
  for each row
  execute function public.enforce_contact_linked_user_id();


-- ---------------------------------------------------------------------------
-- B. group_members.user_id pinning
-- ---------------------------------------------------------------------------

drop policy if exists "group_members: owner insert" on public.group_members;

create policy "group_members: owner insert"
  on public.group_members for insert
  with check (
    -- Caller must own the target group.
    exists (
      select 1 from public.groups g
      where g.id       = group_id
        and g.owner_id = auth.uid()
    )

    -- contact_id, if supplied, must be a contact owned by the caller.
    and (
      contact_id is null
      or exists (
        select 1 from public.contacts c
        where c.id       = contact_id
          and c.owner_id = auth.uid()
      )
    )

    -- user_id, if supplied, must equal the linked_user_id on the caller's
    -- own contact record.  The trigger above ensures linked_user_id itself
    -- cannot be arbitrary client-controlled data.
    and (
      user_id is null
      or (
        contact_id is not null
        and exists (
          select 1 from public.contacts c
          where c.id             = contact_id
            and c.owner_id       = auth.uid()
            and c.linked_user_id = user_id
        )
      )
    )
  );

drop policy if exists "group_members: owner update" on public.group_members;

create policy "group_members: owner update"
  on public.group_members for update
  using (
    -- Caller must own the group that holds the existing row (OLD values).
    exists (
      select 1 from public.groups g
      where g.id       = group_id
        and g.owner_id = auth.uid()
    )
  )
  with check (
    -- Caller must still own the group after the update (NEW values).
    exists (
      select 1 from public.groups g
      where g.id       = group_id
        and g.owner_id = auth.uid()
    )

    -- contact_id, if supplied, must be a contact owned by the caller.
    and (
      contact_id is null
      or exists (
        select 1 from public.contacts c
        where c.id       = contact_id
          and c.owner_id = auth.uid()
      )
    )

    -- Same user_id gate as INSERT: must derive from the caller-owned contact.
    and (
      user_id is null
      or (
        contact_id is not null
        and exists (
          select 1 from public.contacts c
          where c.id             = contact_id
            and c.owner_id       = auth.uid()
            and c.linked_user_id = user_id
        )
      )
    )
  );
