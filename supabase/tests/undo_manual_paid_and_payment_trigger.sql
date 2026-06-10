-- =============================================================
-- Tests: migrations 20260609000005 and 20260609000006
--
-- 00005 — debt_undo_manual_paid_is_valid(uuid, debt_status)
--         and the "debts: creator undo manual paid update" policy
-- 00006 — before_payment_insert() status guard and ceiling check
--
-- Run as postgres (superuser) in the Supabase SQL editor or psql.
-- All changes roll back at the end — safe to run against any environment.
--
-- Expected output (9 rows, all PASS):
--   1  PASS  00005: valid undo (pre_paid_status=accepted) accepted
--   2  PASS  00005: wrong target status 'pending' blocked
--   3  PASS  00005: wrong target status 'partial' blocked
--   4  PASS  00006: valid partial payment accepted
--   5  PASS  00006: exact remaining payment accepted
--   6  PASS  00006: overpay blocked
--   7  PASS  00006: zero amount blocked
--   8  PASS  00006: negative amount blocked
--   9  PASS  00006: paid-status debt blocked
-- =============================================================

BEGIN;

CREATE TEMP TABLE test_results (
  test_num integer,
  result   text,
  detail   text
) ON COMMIT DROP;


-- ─────────────────────────────────────────────────────────────
-- SETUP (runs as postgres/superuser; bypasses RLS)
-- ─────────────────────────────────────────────────────────────

DO $setup$
DECLARE
  v_alice_id CONSTANT uuid := 'a1ce0001-0005-0006-0000-000000000001';
  v_bob_id   CONSTANT uuid := 'b0b00001-0005-0006-0000-000000000001';
BEGIN
  -- Auth rows required for debts.creator_id FK.
  -- Column list matches Supabase's auth.users schema; adjust
  -- is_sso_user / is_anonymous if your version requires them.
  INSERT INTO auth.users (
    id, aud, role, email,
    encrypted_password,
    raw_app_meta_data, raw_user_meta_data,
    is_super_admin, created_at, updated_at
  ) VALUES
    (v_alice_id, 'authenticated', 'authenticated',
     'alice_00005_00006_test@internal',
     '', '{}', '{}', false, now(), now()),
    (v_bob_id,   'authenticated', 'authenticated',
     'bob_00005_00006_test@internal',
     '', '{}', '{}', false, now(), now())
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.profiles (id)
  VALUES (v_alice_id), (v_bob_id)
  ON CONFLICT (id) DO NOTHING;

  -- ── 00005 debt ──────────────────────────────────────────────
  -- Alice created, Bob owes, currently manually paid with pre_paid_status='accepted'.
  -- Tests 1-3 exercise the undo policy against this row.
  INSERT INTO public.debts (
    id, creator_id, payer_user_id, borrower_user_id,
    amount_cents, paid_cents, status,
    manually_paid, pre_paid_status,
    client_request_id
  ) VALUES (
    'de570005-0000-0000-0000-000000000001',
    v_alice_id, v_alice_id, v_bob_id,
    10000, 10000, 'paid',
    true, 'accepted',
    'test-00005-undo-001'
  );

  -- ── 00006 debts ─────────────────────────────────────────────
  -- One debt per trigger scenario so after_payment_insert cannot
  -- influence a later test's remaining balance.

  -- Test 4 — valid partial (10 000 total, 0 paid → 10 000 remaining)
  INSERT INTO public.debts (
    id, creator_id, payer_user_id, borrower_user_id,
    amount_cents, paid_cents, status, client_request_id
  ) VALUES (
    'de570006-0000-0000-0000-000000000001',
    v_alice_id, v_alice_id, v_bob_id,
    10000, 0, 'accepted', 'test-00006-partial'
  );

  -- Test 5 — exact remaining (10 000 total, 3 000 paid → 7 000 remaining)
  INSERT INTO public.debts (
    id, creator_id, payer_user_id, borrower_user_id,
    amount_cents, paid_cents, status, client_request_id
  ) VALUES (
    'de570006-0000-0000-0000-000000000002',
    v_alice_id, v_alice_id, v_bob_id,
    10000, 3000, 'accepted', 'test-00006-exact'
  );

  -- Test 6 — overpay (10 000 total, 9 000 paid → 1 000 remaining)
  INSERT INTO public.debts (
    id, creator_id, payer_user_id, borrower_user_id,
    amount_cents, paid_cents, status, client_request_id
  ) VALUES (
    'de570006-0000-0000-0000-000000000003',
    v_alice_id, v_alice_id, v_bob_id,
    10000, 9000, 'accepted', 'test-00006-overpay'
  );

  -- Test 7 & 8 — zero / negative (10 000 total, 0 paid; trigger raises before row is written)
  INSERT INTO public.debts (
    id, creator_id, payer_user_id, borrower_user_id,
    amount_cents, paid_cents, status, client_request_id
  ) VALUES (
    'de570006-0000-0000-0000-000000000004',
    v_alice_id, v_alice_id, v_bob_id,
    10000, 0, 'accepted', 'test-00006-zero-neg'
  );

  -- Test 9 — paid-status blocked (status='paid'; trigger must reject payment)
  INSERT INTO public.debts (
    id, creator_id, payer_user_id, borrower_user_id,
    amount_cents, paid_cents, status, client_request_id
  ) VALUES (
    'de570006-0000-0000-0000-000000000005',
    v_alice_id, v_alice_id, v_bob_id,
    10000, 10000, 'paid', 'test-00006-paid-status'
  );
END $setup$;


-- =============================================================
-- Suite 00005 — "debts: creator undo manual paid update" policy
--               via debt_undo_manual_paid_is_valid(uuid, debt_status)
-- =============================================================

-- ─────────────────────────────────────────────────────────────
-- TEST 1 — Valid undo: pre_paid_status='accepted', propose 'accepted'
-- Alice (creator) undoes the manual paid mark.
-- Expect: 1 row updated, debt status → 'accepted'.
-- ─────────────────────────────────────────────────────────────

DO $t1$
DECLARE
  v_rows   integer;
  v_status text;
BEGIN
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims',
    '{"sub":"a1ce0001-0005-0006-0000-000000000001","role":"authenticated"}', true);

  UPDATE public.debts
     SET status = 'accepted', manually_paid = false
   WHERE id = 'de570005-0000-0000-0000-000000000001';
  GET DIAGNOSTICS v_rows = ROW_COUNT;

  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claims', '{}', true);

  SELECT status INTO v_status
    FROM public.debts WHERE id = 'de570005-0000-0000-0000-000000000001';

  INSERT INTO test_results VALUES (
    1,
    CASE WHEN v_rows = 1 AND v_status = 'accepted' THEN 'PASS' ELSE 'FAIL' END,
    CASE WHEN v_rows = 1 AND v_status = 'accepted'
         THEN '00005: valid undo (pre_paid_status=accepted) accepted'
         ELSE '00005: valid undo rejected unexpectedly (rows=' || v_rows
              || ', status=' || coalesce(v_status, 'NULL') || ')' END
  );

  -- Reset for tests 2 and 3.
  UPDATE public.debts
     SET status = 'paid', manually_paid = true
   WHERE id = 'de570005-0000-0000-0000-000000000001';
END $t1$;


-- ─────────────────────────────────────────────────────────────
-- TEST 2 — Wrong target status 'pending': pre_paid_status='accepted'
-- Alice proposes status='pending'; helper returns false → blocked.
-- Expect: 0 rows updated (or exception), debt status stays 'paid'.
-- ─────────────────────────────────────────────────────────────

DO $t2$
DECLARE
  v_rows   integer;
  v_status text;
BEGIN
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims',
    '{"sub":"a1ce0001-0005-0006-0000-000000000001","role":"authenticated"}', true);

  BEGIN
    UPDATE public.debts
       SET status = 'pending', manually_paid = false
     WHERE id = 'de570005-0000-0000-0000-000000000001';
    GET DIAGNOSTICS v_rows = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    v_rows := 0;
  END;

  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claims', '{}', true);

  SELECT status INTO v_status
    FROM public.debts WHERE id = 'de570005-0000-0000-0000-000000000001';

  INSERT INTO test_results VALUES (
    2,
    CASE WHEN v_rows = 0 AND v_status = 'paid' THEN 'PASS' ELSE 'FAIL' END,
    CASE WHEN v_rows = 0 AND v_status = 'paid'
         THEN '00005: wrong target status ''pending'' blocked'
         ELSE '00005: wrong status ''pending'' was accepted (rows=' || v_rows
              || ', status=' || coalesce(v_status, 'NULL') || ')' END
  );
END $t2$;


-- ─────────────────────────────────────────────────────────────
-- TEST 3 — Wrong target status 'partial': pre_paid_status='accepted'
-- Alice proposes status='partial'; helper returns false → blocked.
-- Expect: 0 rows updated (or exception), debt status stays 'paid'.
-- ─────────────────────────────────────────────────────────────

DO $t3$
DECLARE
  v_rows   integer;
  v_status text;
BEGIN
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims',
    '{"sub":"a1ce0001-0005-0006-0000-000000000001","role":"authenticated"}', true);

  BEGIN
    UPDATE public.debts
       SET status = 'partial', manually_paid = false
     WHERE id = 'de570005-0000-0000-0000-000000000001';
    GET DIAGNOSTICS v_rows = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    v_rows := 0;
  END;

  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claims', '{}', true);

  SELECT status INTO v_status
    FROM public.debts WHERE id = 'de570005-0000-0000-0000-000000000001';

  INSERT INTO test_results VALUES (
    3,
    CASE WHEN v_rows = 0 AND v_status = 'paid' THEN 'PASS' ELSE 'FAIL' END,
    CASE WHEN v_rows = 0 AND v_status = 'paid'
         THEN '00005: wrong target status ''partial'' blocked'
         ELSE '00005: wrong status ''partial'' was accepted (rows=' || v_rows
              || ', status=' || coalesce(v_status, 'NULL') || ')' END
  );
END $t3$;


-- =============================================================
-- Suite 00006 — before_payment_insert() status guard and ceiling
--
-- Tests run as postgres (superuser) to isolate trigger behaviour
-- from RLS.  The trigger is SECURITY DEFINER and fires regardless
-- of caller role; postgres simply skips the RLS layer so only
-- the trigger can block or allow each insert.
-- =============================================================

-- ─────────────────────────────────────────────────────────────
-- TEST 4 — Valid partial payment (5 000 of 10 000 remaining)
-- Expect: payment inserted, no exception.
-- ─────────────────────────────────────────────────────────────

DO $t4$
DECLARE
  v_err text;
BEGIN
  BEGIN
    INSERT INTO public.payments (debt_id, amount_cents, client_request_id)
    VALUES ('de570006-0000-0000-0000-000000000001', 5000, 'tp-00006-partial');
  EXCEPTION WHEN OTHERS THEN
    v_err := sqlerrm;
  END;

  INSERT INTO test_results VALUES (
    4,
    CASE WHEN v_err IS NULL THEN 'PASS' ELSE 'FAIL' END,
    CASE WHEN v_err IS NULL THEN '00006: valid partial payment accepted'
         ELSE '00006: valid partial blocked unexpectedly: ' || v_err END
  );
END $t4$;


-- ─────────────────────────────────────────────────────────────
-- TEST 5 — Exact remaining payment (7 000 of 7 000 remaining)
-- Debt has 10 000 total, 3 000 already paid → 7 000 remaining.
-- Expect: payment inserted, after_payment_insert marks debt paid.
-- ─────────────────────────────────────────────────────────────

DO $t5$
DECLARE
  v_err text;
BEGIN
  BEGIN
    INSERT INTO public.payments (debt_id, amount_cents, client_request_id)
    VALUES ('de570006-0000-0000-0000-000000000002', 7000, 'tp-00006-exact');
  EXCEPTION WHEN OTHERS THEN
    v_err := sqlerrm;
  END;

  INSERT INTO test_results VALUES (
    5,
    CASE WHEN v_err IS NULL THEN 'PASS' ELSE 'FAIL' END,
    CASE WHEN v_err IS NULL THEN '00006: exact remaining payment accepted'
         ELSE '00006: exact remaining blocked unexpectedly: ' || v_err END
  );
END $t5$;


-- ─────────────────────────────────────────────────────────────
-- TEST 6 — Overpay (2 000 against 1 000 remaining)
-- Debt has 10 000 total, 9 000 paid → 1 000 remaining.
-- Expect: trigger raises 'exceeds remaining balance'.
-- ─────────────────────────────────────────────────────────────

DO $t6$
DECLARE
  v_err text;
BEGIN
  BEGIN
    INSERT INTO public.payments (debt_id, amount_cents, client_request_id)
    VALUES ('de570006-0000-0000-0000-000000000003', 2000, 'tp-00006-overpay');
  EXCEPTION WHEN OTHERS THEN
    v_err := sqlerrm;
  END;

  INSERT INTO test_results VALUES (
    6,
    CASE WHEN v_err IS NOT NULL THEN 'PASS' ELSE 'FAIL' END,
    CASE WHEN v_err IS NOT NULL THEN '00006: overpay blocked (' || v_err || ')'
         ELSE '00006: overpay was accepted — ceiling check missing' END
  );
END $t6$;


-- ─────────────────────────────────────────────────────────────
-- TEST 7 — Zero amount
-- Expect: trigger raises 'amount_cents must be positive'.
-- ─────────────────────────────────────────────────────────────

DO $t7$
DECLARE
  v_err text;
BEGIN
  BEGIN
    INSERT INTO public.payments (debt_id, amount_cents, client_request_id)
    VALUES ('de570006-0000-0000-0000-000000000004', 0, 'tp-00006-zero');
  EXCEPTION WHEN OTHERS THEN
    v_err := sqlerrm;
  END;

  INSERT INTO test_results VALUES (
    7,
    CASE WHEN v_err IS NOT NULL THEN 'PASS' ELSE 'FAIL' END,
    CASE WHEN v_err IS NOT NULL THEN '00006: zero amount blocked (' || v_err || ')'
         ELSE '00006: zero amount was accepted — positive check missing' END
  );
END $t7$;


-- ─────────────────────────────────────────────────────────────
-- TEST 8 — Negative amount
-- Expect: trigger raises 'amount_cents must be positive'.
-- ─────────────────────────────────────────────────────────────

DO $t8$
DECLARE
  v_err text;
BEGIN
  BEGIN
    INSERT INTO public.payments (debt_id, amount_cents, client_request_id)
    VALUES ('de570006-0000-0000-0000-000000000004', -100, 'tp-00006-negative');
  EXCEPTION WHEN OTHERS THEN
    v_err := sqlerrm;
  END;

  INSERT INTO test_results VALUES (
    8,
    CASE WHEN v_err IS NOT NULL THEN 'PASS' ELSE 'FAIL' END,
    CASE WHEN v_err IS NOT NULL THEN '00006: negative amount blocked (' || v_err || ')'
         ELSE '00006: negative amount was accepted — positive check missing' END
  );
END $t8$;


-- ─────────────────────────────────────────────────────────────
-- TEST 9 — Paid-status debt blocked
-- Debt status is already 'paid'; trigger must reject any payment.
-- Expect: trigger raises 'cannot be paid: current status is ''paid'''.
-- ─────────────────────────────────────────────────────────────

DO $t9$
DECLARE
  v_err text;
BEGIN
  BEGIN
    INSERT INTO public.payments (debt_id, amount_cents, client_request_id)
    VALUES ('de570006-0000-0000-0000-000000000005', 100, 'tp-00006-paid-status');
  EXCEPTION WHEN OTHERS THEN
    v_err := sqlerrm;
  END;

  INSERT INTO test_results VALUES (
    9,
    CASE WHEN v_err IS NOT NULL THEN 'PASS' ELSE 'FAIL' END,
    CASE WHEN v_err IS NOT NULL THEN '00006: paid-status debt blocked (' || v_err || ')'
         ELSE '00006: payment on paid debt accepted — status guard missing' END
  );
END $t9$;


-- ─────────────────────────────────────────────────────────────
-- RESULTS
-- ─────────────────────────────────────────────────────────────

SELECT test_num, result, detail FROM test_results ORDER BY test_num;

ROLLBACK;
