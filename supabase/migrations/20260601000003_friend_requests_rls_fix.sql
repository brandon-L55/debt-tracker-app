-- =============================================================
-- Tighten friend_requests update RLS policy.
--
-- The original "parties update" policy allowed either party (sender
-- OR recipient) to update the status column, which let the sender
-- accept their own outgoing request.  Replace it with a
-- recipient-only policy so only the recipient can accept or reject.
--
-- The sender still cancels via DELETE (unchanged).
-- Both parties can still READ (unchanged).
-- =============================================================

drop policy if exists "friend_requests: parties update" on public.friend_requests;

create policy "friend_requests: recipient update"
  on public.friend_requests for update
  using (recipient_user_id = auth.uid());
