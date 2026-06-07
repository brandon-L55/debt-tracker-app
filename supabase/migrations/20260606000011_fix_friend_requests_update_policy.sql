-- =============================================================
-- Fix: friend_requests recipient UPDATE policy — add WITH CHECK
--
-- Root cause (identified in final security audit):
--   The "friend_requests: recipient update" policy (added in
--   20260601000003) had only a USING clause and no WITH CHECK.
--   PostgreSQL reuses USING as the implicit WITH CHECK, which only
--   constrains that recipient_user_id = auth.uid() on the new row.
--   A recipient could therefore UPDATE any other column — including
--   sender_user_id — while that constraint remained satisfied.
--
--   Because has_profile_access() (20260606000002) grants profile
--   SELECT access when a friend_requests row links two users, a
--   recipient with any incoming request could change sender_user_id
--   to an arbitrary UUID and gain full profile SELECT access to that
--   account (phone, email, expo_push_token, payment handles) without
--   any real relationship.
--
-- Fix:
--   Replace the policy with one that adds an explicit WITH CHECK:
--     1. recipient_user_id must remain auth.uid() (already covered
--        by USING but stated explicitly for clarity).
--     2. sender_user_id must equal its stored value — locked via a
--        correlated subquery on the same row.  The existing SELECT
--        policy permits the recipient to read the row, so no
--        SECURITY DEFINER helper is required.
--     3. status must be 'accepted' or 'rejected' — the only two
--        values a recipient legitimately sets.  'pending' is the
--        sender's initial value and must not be resettable.
--
-- App impact: none.
--   acceptFriendRequest()  updates { status: 'accepted' } — passes.
--   rejectFriendRequest()  updates { status: 'rejected' } — passes.
--   No other column is ever updated by application code.
-- =============================================================

drop policy if exists "friend_requests: recipient update" on public.friend_requests;

create policy "friend_requests: recipient update"
  on public.friend_requests for update
  using (recipient_user_id = auth.uid())
  with check (
    -- Caller remains the recipient after the update.
    recipient_user_id = auth.uid()

    -- sender_user_id is immutable: the new value must match the stored value.
    -- The correlated subquery reads the pre-update row; the SELECT policy
    -- permits the recipient to read rows where recipient_user_id = auth.uid().
    and sender_user_id = (
      select fr.sender_user_id
        from public.friend_requests fr
       where fr.id = id
    )

    -- Only legitimate recipient responses are permitted.
    -- 'pending' is the sender-assigned initial state and cannot be restored.
    and status in ('accepted', 'rejected')
  );
