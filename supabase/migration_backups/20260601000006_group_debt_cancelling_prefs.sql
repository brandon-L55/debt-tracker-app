-- =============================================================
-- Per-user, per-group Debt Cancelling preferences.
--
-- intro_seen  — whether the two-slide intro modal has been shown
--               at least once for this user in this group.
--               Controls automatic popup on first visit.
--
-- enabled     — whether this user wants to participate in Debt
--               Cancelling (simplified payments) for this group.
--               Toggling off hides the simplified view for them;
--               no debts are deleted.
-- =============================================================

create table if not exists public.group_debt_cancelling_preferences (
  id          uuid        primary key default gen_random_uuid(),
  group_id    uuid        not null references public.groups(id) on delete cascade,
  user_id     uuid        not null references auth.users(id) on delete cascade,
  intro_seen  boolean     not null default false,
  enabled     boolean     not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (group_id, user_id)
);

alter table public.group_debt_cancelling_preferences enable row level security;

-- Each user manages only their own preference row.
create policy "debt_cancelling_prefs: owner select"
  on public.group_debt_cancelling_preferences for select
  using (user_id = auth.uid());

create policy "debt_cancelling_prefs: owner insert"
  on public.group_debt_cancelling_preferences for insert
  with check (user_id = auth.uid());

create policy "debt_cancelling_prefs: owner update"
  on public.group_debt_cancelling_preferences for update
  using (user_id = auth.uid());
