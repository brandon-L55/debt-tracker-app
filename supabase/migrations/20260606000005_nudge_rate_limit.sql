-- =============================================================
-- Nudge rate limiting — max 1 nudge per (sender, recipient) per 24 h.
--
-- Enforced at the DB layer so direct PostgREST inserts are also
-- blocked, not just the in-app UI cooldown.
--
-- Also adds a recipient-side delete policy so recipients can
-- dismiss/archive nudges (service-ready; UI wiring is separate).
-- =============================================================

-- Trigger function: raises if the same sender nudged this recipient
-- within the last 24 hours.
create or replace function public.enforce_nudge_rate_limit()
returns trigger language plpgsql security definer as $$
begin
  if exists (
    select 1 from public.debt_nudges
    where sender_user_id  = new.sender_user_id
      and recipient_user_id = new.recipient_user_id
      and created_at > now() - interval '24 hours'
    limit 1
  ) then
    raise exception 'nudge_rate_limited'
      using hint = 'You can only nudge this person once every 24 hours.';
  end if;
  return new;
end;
$$;

create trigger nudge_rate_limit_trigger
  before insert on public.debt_nudges
  for each row execute procedure public.enforce_nudge_rate_limit();

-- Recipient can delete nudges addressed to them.
create policy "debt_nudges: recipient delete"
  on public.debt_nudges for delete
  using (recipient_user_id = auth.uid());
