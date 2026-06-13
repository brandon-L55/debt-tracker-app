-- =============================================================
-- Fix: contact_link_matches_profile() friend-request path does not
--      exclude blocked relationships.
--
-- Root cause (found in 20260609000011):
--   The friend-request branch of contact_link_matches_profile() allows
--   contacts.linked_user_id to be set to any UUID where an accepted
--   friend request exists between the two parties.  Blocking a user
--   does not delete the friend_request row, so a blocked user can
--   still satisfy the trigger and link a contact to the person who
--   blocked them.  This lets the blocked user insert a group_members
--   row with user_id = blocker's UUID, granting full read access to
--   the blocker's group debts and the ability to inject new debts into
--   that group.
--
-- Fix:
--   Wrap the friend-request branch in a sub-expression that also
--   requires that neither party has blocked the other.  The function is
--   already SECURITY DEFINER so it can read blocked_users bypassing RLS.
--   All other branches (email / invited_email / username / phone
--   identifier matching) are unchanged — a shared contact identifier
--   is a stronger proof of relationship and is not gated on blocking.
--
-- No table DDL changes.  No RLS policy changes.  Only the function body
-- is replaced; the trigger (trg_enforce_contact_linked_user_id) and the
-- REVOKE remain as established in 20260609000011.
-- =============================================================

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

    -- ── Identifier-match paths (unchanged) ───────────────────────────────
    -- A shared email, invited_email, username, or phone is a direct proof
    -- of identity and is not affected by the blocked-users relationship.
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

    -- ── Friend-request path (restricted) ─────────────────────────────────
    -- An accepted mutual friend request is allowed only when neither
    -- party has blocked the other.  This function is SECURITY DEFINER so
    -- it can read blocked_users without triggering RLS.
    or (
      exists (
        select 1
        from public.friend_requests fr
        where fr.status = 'accepted'
          and (
            (fr.sender_user_id    = auth.uid() and fr.recipient_user_id = p_linked_user_id)
            or
            (fr.recipient_user_id = auth.uid() and fr.sender_user_id   = p_linked_user_id)
          )
      )
      and not exists (
        select 1
        from public.blocked_users bu
        where (bu.blocker_user_id = auth.uid()       and bu.blocked_user_id = p_linked_user_id)
           or (bu.blocker_user_id = p_linked_user_id and bu.blocked_user_id = auth.uid())
      )
    );
$$;

-- Caller-facing EXECUTE is still denied — the function is only reachable
-- through the enforce_contact_linked_user_id trigger (SECURITY DEFINER).
revoke execute on function public.contact_link_matches_profile(uuid, text, text, text, text)
  from public, anon, authenticated;
