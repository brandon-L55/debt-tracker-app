-- Debt creation idempotency

alter table public.debts
  add column if not exists client_request_id text;

update public.debts
set client_request_id = 'legacy:' || id::text
where client_request_id is null;

alter table public.debts
  alter column client_request_id set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'debts_client_request_id_key'
      and conrelid = 'public.debts'::regclass
  ) then
    alter table public.debts
      add constraint debts_client_request_id_key unique (client_request_id);
  end if;
end $$;
