-- blocked_users: account-level contact blocking
--
-- RLS design: a user can only see their own outgoing blocks.
-- Blocks are NOT visible to the blocked person (they cannot query
-- blocked_users to discover that they were blocked).
-- Server-side enforcement (nudge trigger below) handles cases where
-- the blocked person tries to interact with the blocker.

create table public.blocked_users (
  id              uuid primary key default gen_random_uuid(),
  blocker_user_id uuid not null references auth.users(id) on delete cascade,
  blocked_user_id uuid not null references auth.users(id) on delete cascade,
  created_at      timestamptz not null default now(),
  constraint blocked_users_unique unique (blocker_user_id, blocked_user_id)
);

alter table public.blocked_users enable row level security;

create policy "blocked_users: select own rows"
  on public.blocked_users for select
  using (blocker_user_id = auth.uid());

create policy "blocked_users: insert own rows"
  on public.blocked_users for insert
  with check (blocker_user_id = auth.uid());

create policy "blocked_users: delete own rows"
  on public.blocked_users for delete
  using (blocker_user_id = auth.uid());

-- Performance indexes
create index blocked_users_blocker_idx on public.blocked_users (blocker_user_id);
create index blocked_users_blocked_idx on public.blocked_users (blocked_user_id);

-- Trigger: prevent nudging a user who has blocked the sender.
-- Runs SECURITY DEFINER so it can read blocked_users from the
-- recipient's perspective without exposing RLS to the caller.
create or replace function public.check_nudge_not_blocked()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  if exists (
    select 1 from public.blocked_users
    where blocker_user_id = new.recipient_user_id
      and blocked_user_id = new.sender_user_id
  ) then
    raise exception 'You cannot interact with this contact.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function public.check_nudge_not_blocked() from public, anon, authenticated;

create trigger trg_check_nudge_not_blocked
  before insert on public.debt_nudges
  for each row execute function public.check_nudge_not_blocked();
