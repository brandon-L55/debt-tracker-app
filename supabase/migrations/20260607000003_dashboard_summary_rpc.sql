-- =============================================================
-- Dashboard summary RPC: server-side aggregation
--
-- Problem
-- -------
-- app/(tabs)/index.tsx computes you_owe / owed_to_you by loading
-- ALL debts for the user into the JS context and then filtering.
-- For heavy users, that's hundreds of rows transferred to the
-- client on every app launch just to compute two numbers.
--
-- Fix
-- ---
-- get_dashboard_summary() does the aggregation in PostgreSQL and
-- returns a single jsonb object.  The frontend can call this once
-- at startup and replace the four local `reduce()` calls.
--
-- Design notes
-- ------------
-- * SECURITY DEFINER — bypasses RLS so the function can do a single
--   table scan rather than four separate policy-filtered scans.
--   It's safe because every aggregate is gated to auth.uid() values
--   only, and no raw rows are returned.
-- * paid_cents is already maintained by the after_payment_insert()
--   trigger, so remainingAmount = (amount_cents - paid_cents) / 100.
-- * totalPaidAmount / totalReceivedAmount in rowToDebt() are derived
--   from paid_cents on the debt row (direction=me → paidCents, else 0),
--   so the RPC matches by querying debts, not the payments table.
-- * all amounts returned are in cents to avoid floating-point rounding.
-- =============================================================

create or replace function public.get_dashboard_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid                 uuid    := auth.uid();
  v_you_owe_cents       bigint  := 0;
  v_owed_to_you_cents   bigint  := 0;
  v_total_paid_cents    bigint  := 0;
  v_total_received_cents bigint := 0;
  v_pending_count       integer := 0;
  v_active_debt_count   integer := 0;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  -- Single scan over the user's debts for all six metrics.
  --
  -- Roles (matching rowToDebt direction logic):
  --   borrower_user_id = v_uid  → direction="me"  → user owes money
  --   payer_user_id    = v_uid  → direction="them" → money owed to user
  --
  -- pending_count: debts the user needs to approve (created by someone else)
  select
    -- you_owe: remaining balance on active debts where user is borrower
    coalesce(sum(
      case when borrower_user_id = v_uid
                and status in ('accepted', 'partial')
           then (amount_cents - coalesce(paid_cents, 0))
           else 0
      end
    ), 0),

    -- owed_to_you: remaining balance on active debts where user is lender
    coalesce(sum(
      case when payer_user_id = v_uid
                and status in ('accepted', 'partial')
           then (amount_cents - coalesce(paid_cents, 0))
           else 0
      end
    ), 0),

    -- total_paid: cumulative paid_cents on debts where user is borrower
    -- matches totalPaidAmount in rowToDebt (direction="me" → paidCents/100)
    coalesce(sum(
      case when borrower_user_id = v_uid
           then coalesce(paid_cents, 0)
           else 0
      end
    ), 0),

    -- total_received: cumulative paid_cents on debts where user is lender
    -- matches totalReceivedAmount in rowToDebt (direction="them" → paidCents/100)
    coalesce(sum(
      case when payer_user_id = v_uid
           then coalesce(paid_cents, 0)
           else 0
      end
    ), 0),

    -- pending_count: requests from others waiting for the user's approval
    coalesce(sum(
      case when status = 'pending'
                and creator_id <> v_uid
                and (payer_user_id = v_uid or borrower_user_id = v_uid)
           then 1
           else 0
      end
    ), 0)::integer,

    -- active_debt_count: number of accepted/partial debt rows involving user
    coalesce(count(
      case when status in ('accepted', 'partial')
           then 1
      end
    ), 0)::integer

  into
    v_you_owe_cents,
    v_owed_to_you_cents,
    v_total_paid_cents,
    v_total_received_cents,
    v_pending_count,
    v_active_debt_count

  from public.debts
  where creator_id       = v_uid
     or payer_user_id    = v_uid
     or borrower_user_id = v_uid;

  return jsonb_build_object(
    'you_owe_cents',         v_you_owe_cents,
    'owed_to_you_cents',     v_owed_to_you_cents,
    'total_paid_cents',      v_total_paid_cents,
    'total_received_cents',  v_total_received_cents,
    'pending_count',         v_pending_count,
    'active_debt_count',     v_active_debt_count
  );
end;
$$;

-- Explicitly deny unauthenticated callers, then grant to authenticated.
revoke execute on function public.get_dashboard_summary() from public, anon;
grant  execute on function public.get_dashboard_summary() to authenticated;
