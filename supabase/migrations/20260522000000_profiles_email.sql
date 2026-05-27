-- =============================================================
-- Add email to public.profiles and keep it in sync with auth.users.
--
-- Why: findOrCreateContactByEmail looks up profiles by email to resolve
--      a real user_id for linked_user_id / borrower_user_id /
--      payer_user_id.  Without this column the lookup always returns
--      null and cross-account debts are never visible to Account B.
-- =============================================================

-- 1. Add the column (idempotent).
alter table public.profiles
  add column if not exists email text;

-- 2. Unique index so the eq("email", …) lookup is fast and collision-safe.
create unique index if not exists profiles_email_idx
  on public.profiles(lower(email))
  where email is not null;

-- 3. Back-fill from auth.users for every existing profile row where email
--    is missing or stale.  Runs unconditionally so a partial-apply is safe.
update public.profiles p
set    email = lower(trim(u.email))
from   auth.users u
where  p.id = u.id
  and  u.email is not null
  and  p.email is distinct from lower(trim(u.email));

-- 4. Replace handle_new_user() so it copies email on INSERT and on any
--    future email change (e.g. email confirmation re-fires the trigger).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, lower(trim(new.email)))
  on conflict (id) do update
    set email = excluded.email
    where profiles.email is distinct from excluded.email;
  return new;
end;
$$;

-- 5. Allow any authenticated user to read profiles by email so that
--    findOrCreateContactByEmail() can resolve a user_id without
--    needing service_role.
drop policy if exists "profiles: email lookup" on public.profiles;

create policy "profiles: email lookup"
  on public.profiles for select
  using (auth.uid() is not null);

-- 6. Allow each user to insert/update their own profile row so that
--    the client-side self-heal upsert in AuthContext works.
drop policy if exists "profiles: owner insert" on public.profiles;
create policy "profiles: owner insert"
  on public.profiles for insert
  with check (id = auth.uid());

drop policy if exists "profiles: owner update" on public.profiles;
create policy "profiles: owner update"
  on public.profiles for update
  using (id = auth.uid());
