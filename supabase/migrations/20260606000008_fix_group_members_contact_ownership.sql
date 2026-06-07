-- Fix: group_members INSERT and UPDATE policies must verify that any supplied
-- contact_id belongs to the authenticated user.
--
-- Previously the policies only checked that the caller owned the group, allowing
-- a group owner to insert a contact_id owned by a different user via direct API.

-- ── INSERT ────────────────────────────────────────────────────────────────────

drop policy if exists "group_members: owner insert" on public.group_members;

create policy "group_members: owner insert"
  on public.group_members for insert
  with check (
    exists (
      select 1 from public.groups g
      where g.id       = group_id
        and g.owner_id = auth.uid()
    )
    and (
      contact_id is null
      or exists (
        select 1 from public.contacts c
        where c.id       = contact_id
          and c.owner_id = auth.uid()
      )
    )
  );

-- ── UPDATE ────────────────────────────────────────────────────────────────────
-- USING  : restricts which existing rows the caller can target (must own the group).
-- WITH CHECK: restricts what values are valid after the update (same ownership rules).

drop policy if exists "group_members: owner update" on public.group_members;

create policy "group_members: owner update"
  on public.group_members for update
  using (
    exists (
      select 1 from public.groups g
      where g.id       = group_id
        and g.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.groups g
      where g.id       = group_id
        and g.owner_id = auth.uid()
    )
    and (
      contact_id is null
      or exists (
        select 1 from public.contacts c
        where c.id       = contact_id
          and c.owner_id = auth.uid()
      )
    )
  );
