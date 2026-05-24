-- MVP email invite metadata and claim/link RPC.

alter table public.contacts
  add column if not exists invited_email text,
  add column if not exists invite_status text,
  add column if not exists invite_created_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'contacts_invite_status_check'
      and conrelid = 'public.contacts'::regclass
  ) then
    alter table public.contacts
      add constraint contacts_invite_status_check
      check (invite_status is null or invite_status in ('pending', 'claimed'));
  end if;
end $$;

create index if not exists contacts_owner_invited_email_idx
  on public.contacts(owner_id, lower(invited_email))
  where invited_email is not null;

create index if not exists contacts_invited_email_pending_idx
  on public.contacts(lower(invited_email))
  where invited_email is not null and invite_status = 'pending';

create or replace function public.claim_invited_contacts()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  if auth.uid() is null then
    return;
  end if;

  select lower(trim(email))
  into v_email
  from public.profiles
  where id = auth.uid();

  if v_email is null or v_email = '' then
    return;
  end if;

  update public.contacts
  set linked_user_id = auth.uid(),
      invite_status = 'claimed'
  where lower(trim(invited_email)) = v_email
    and (linked_user_id is null or linked_user_id = auth.uid());
end;
$$;

grant execute on function public.claim_invited_contacts()
  to authenticated;
