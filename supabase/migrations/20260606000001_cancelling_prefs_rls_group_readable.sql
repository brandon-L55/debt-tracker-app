-- The original "owner select" policy only allows a user to read their own
-- preference row.  The simplification service needs to read ALL opted-in rows
-- for a group so it can filter out debts where either party has not opted in.
--
-- Replace owner-only select with a group-member-scoped select that reuses the
-- existing is_group_member() SECURITY DEFINER helper (no new trust boundary).
-- Insert and update policies remain owner-only, unchanged.

drop policy if exists "debt_cancelling_prefs: owner select"
  on public.group_debt_cancelling_preferences;

-- Any member of the group can read preferences for that group.
-- is_group_member() is SECURITY DEFINER so it bypasses RLS on group_members.
create policy "debt_cancelling_prefs: group member select"
  on public.group_debt_cancelling_preferences for select
  using (
    public.is_group_member(group_id, auth.uid())
  );
