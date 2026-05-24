-- =============================================================
-- Enforce server-side payment idempotency
--
-- This migration repairs databases where the earlier client_request_id
-- migration was not applied or left the column nullable.
-- =============================================================

alter table public.payments
  add column if not exists client_request_id text;

update public.payments
   set client_request_id = 'legacy:' || id::text
 where client_request_id is null;

alter table public.payments
  alter column client_request_id set not null;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conrelid = 'public.payments'::regclass
       and conname = 'payments_client_request_id_key'
  ) then
    alter table public.payments
      add constraint payments_client_request_id_key unique (client_request_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conrelid = 'public.payments'::regclass
       and conname = 'payments_request_fallback_key'
  ) then
    alter table public.payments
      add constraint payments_request_fallback_key
      unique (debt_id, payer_user_id, amount_cents, client_request_id);
  end if;
end $$;
