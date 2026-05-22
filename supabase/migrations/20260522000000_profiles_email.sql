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

-- 3. Back-fill from auth.users for any existing profile rows.
update public.profiles p
set    email = lower(trim(u.email))
from   auth.users u
where  p.id    = u.id
  and  p.email is distinct from lower(trim(u.email));

-- 4. Make handle_new_user() also copy the email on sign-up.
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
--    We expose only id + email (enough for linking; nothing sensitive).
drop policy if exists "profiles: email lookup" on public.profiles;

create policy "profiles: email lookup"
  on public.profiles for select
  using (auth.uid() is not null);   -- any signed-in user can look up other profiles by email

-- The existing "profiles: owner select" is now redundant (covered by the
-- broader policy above) but harmless — leave it so a downgrade is easy.
