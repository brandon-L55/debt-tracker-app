-- =============================================================
-- Friend requests
--
-- Tracks the friendship relationship between two app users.
-- Created automatically when a debt is sent to an unadded linked
-- user. Can also be managed directly from the Add Friends screen.
-- =============================================================

create table if not exists public.friend_requests (
  id                uuid        primary key default gen_random_uuid(),
  sender_user_id    uuid        not null references auth.users(id) on delete cascade,
  recipient_user_id uuid        not null references auth.users(id) on delete cascade,
  status            text        not null default 'pending'
                    check (status in ('pending', 'accepted', 'rejected')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  -- One request per ordered pair (sender → recipient).
  -- A request in the reverse direction is allowed (both can request each other).
  unique (sender_user_id, recipient_user_id),
  -- Can't friend yourself.
  check (sender_user_id <> recipient_user_id)
);

create trigger trg_friend_requests_updated_at
  before update on public.friend_requests
  for each row execute function public.set_updated_at();

alter table public.friend_requests enable row level security;

-- Either party can read requests they are part of.
create policy "friend_requests: parties read"
  on public.friend_requests for select
  using (sender_user_id = auth.uid() or recipient_user_id = auth.uid());

-- Authenticated user can insert (must be the sender).
create policy "friend_requests: sender insert"
  on public.friend_requests for insert
  with check (sender_user_id = auth.uid());

-- Either party can update status (accept / reject).
create policy "friend_requests: parties update"
  on public.friend_requests for update
  using (sender_user_id = auth.uid() or recipient_user_id = auth.uid());

-- Sender can delete their own outgoing request (cancel).
create policy "friend_requests: sender delete"
  on public.friend_requests for delete
  using (sender_user_id = auth.uid());
