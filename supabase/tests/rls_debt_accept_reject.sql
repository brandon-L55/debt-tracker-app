-- =============================================================
-- RLS Tests: "debts: participant accept or reject" (C-1 fix)
-- Migration: 20260609000000_fix_debt_accept_reject_column_pinning.sql
--            20260609000001_fix_rls_overpermissive_update_policies.sql
--
-- Run AFTER applying both fix migrations.
-- All changes roll back at the end — safe to run against any environment.
--
-- Expected output (7 rows):
--   1  PASS  normal accept
--   2  PASS  normal reject
--   3  PASS  accept + tamper amount_cents blocked
--   4  PASS  accept + tamper creator_id blocked
--   5  PASS  accept + tamper borrower_user_id blocked
--   6  PASS  accept + tamper group_id blocked
--   7  PASS  creator cannot accept their own debt
--
-- Note: tests 3-7 expect RLS to raise an exception (new row violates
-- policy). The inner BEGIN/EXCEPTION block catches the error and
-- records v_rows = 0 so the result logic stays consistent.
-- =============================================================

BEGIN;

-- Collects one row per test.  ON COMMIT DROP cleans it up on ROLLBACK.
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
  v_alice_id   CONSTANT uuid := 'a1ce0000-0000-0000-0000-000000000001';
  v_bob_id     CONSTANT uuid := 'b0b00000-0000-0000-0000-000000000001';
  v_charlie_id CONSTANT uuid := 'ca1e0000-0000-0000-0000-000000000001';
  v_group1_id  CONSTANT uuid := 'f0000001-0000-0000-0000-000000000001';
  v_group2_id  CONSTANT uuid := 'f0000002-0000-0000-0000-000000000001';
BEGIN
  -- Auth rows required for FK constraints.
  -- Adjust column list if your Supabase version requires is_sso_user / is_anonymous.
  INSERT INTO auth.users (
    id, aud, role, email,
    encrypted_password,
    raw_app_meta_data, raw_user_meta_data,
    is_super_admin, created_at, updated_at
  ) VALUES
    (v_alice_id,   'authenticated', 'authenticated', 'alice_rls_test@internal',
     '', '{}', '{}', false, now(), now()),
    (v_bob_id,     'authenticated', 'authenticated', 'bob_rls_test@internal',
     '', '{}', '{}', false, now(), now()),
    (v_charlie_id, 'authenticated', 'authenticated', 'charlie_rls_test@internal',
     '', '{}', '{}', false, now(), now())
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.profiles (id)
  VALUES (v_alice_id), (v_bob_id), (v_charlie_id)
  ON CONFLICT (id) DO NOTHING;

  -- group1 has Alice + Bob; group2 is intentionally member-free (used in test 6)
  INSERT INTO public.groups (id, owner_id, name) VALUES
    (v_group1_id, v_alice_id, 'RLS Test Group 1'),
    (v_group2_id, v_alice_id, 'RLS Test Group 2')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.group_members (group_id, user_id, role) VALUES
    (v_group1_id, v_alice_id, 'owner'),
    (v_group1_id, v_bob_id,   'member')
  ON CONFLICT DO NOTHING;

  -- Reference debt: Alice (creator + lender) → Bob (borrower), $1,000, group1.
  INSERT INTO public.debts (
    id, creator_id,
    payer_user_id, borrower_user_id,
    amount_cents, currency, status,
    group_id, paid_cents, manually_paid,
    client_request_id
  ) VALUES (
    'deb70000-0000-0000-0000-000000000001',
    v_alice_id, v_alice_id, v_bob_id,
    100000, 'USD', 'pending',
    v_group1_id, 0, false,
    'rls-test-c1-001'
  );
END $setup$;


-- ─────────────────────────────────────────────────────────────
-- TEST 1 — Normal accept (expect PASS: 1 row updated)
-- Bob sets status = 'accepted'; no other column changed.
-- ─────────────────────────────────────────────────────────────

DO $t1$
DECLARE
  v_rows integer;
BEGIN
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims',
    '{"sub":"b0b00000-0000-0000-0000-000000000001","role":"authenticated"}', true);

  UPDATE public.debts SET status = 'accepted'
   WHERE id = 'deb70000-0000-0000-0000-000000000001';
  GET DIAGNOSTICS v_rows = ROW_COUNT;

  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claims', '{}', true);

  INSERT INTO test_results VALUES (
    1,
    CASE WHEN v_rows = 1 THEN 'PASS' ELSE 'FAIL' END,
    CASE WHEN v_rows = 1 THEN 'normal accept'
         ELSE 'normal accept blocked (rows=' || v_rows || ')' END
  );

  -- Reset for next test (superuser bypasses RLS)
  UPDATE public.debts SET status = 'pending'
   WHERE id = 'deb70000-0000-0000-0000-000000000001';
END $t1$;


-- ─────────────────────────────────────────────────────────────
-- TEST 2 — Normal reject (expect PASS: 1 row updated)
-- Bob sets status = 'rejected'; no other column changed.
-- ─────────────────────────────────────────────────────────────

DO $t2$
DECLARE
  v_rows integer;
BEGIN
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims',
    '{"sub":"b0b00000-0000-0000-0000-000000000001","role":"authenticated"}', true);

  UPDATE public.debts SET status = 'rejected'
   WHERE id = 'deb70000-0000-0000-0000-000000000001';
  GET DIAGNOSTICS v_rows = ROW_COUNT;

  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claims', '{}', true);

  INSERT INTO test_results VALUES (
    2,
    CASE WHEN v_rows = 1 THEN 'PASS' ELSE 'FAIL' END,
    CASE WHEN v_rows = 1 THEN 'normal reject'
         ELSE 'normal reject blocked (rows=' || v_rows || ')' END
  );

  UPDATE public.debts SET status = 'pending'
   WHERE id = 'deb70000-0000-0000-0000-000000000001';
END $t2$;


-- ─────────────────────────────────────────────────────────────
-- TEST 3 — Accept + tamper amount_cents (expect PASS: blocked)
-- Bob sets status='accepted' AND amount_cents=100 ($1).
-- debt_accept_reject_is_valid sees stored 100000 ≠ 100 → false.
-- PostgreSQL raises "new row violates row-level security policy";
-- the inner exception block catches it and records v_rows = 0.
-- ─────────────────────────────────────────────────────────────

DO $t3$
DECLARE
  v_rows   integer;
  v_amount integer;
BEGIN
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims',
    '{"sub":"b0b00000-0000-0000-0000-000000000001","role":"authenticated"}', true);

  BEGIN
    UPDATE public.debts SET status = 'accepted', amount_cents = 100
     WHERE id = 'deb70000-0000-0000-0000-000000000001';
    GET DIAGNOSTICS v_rows = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    v_rows := 0;
  END;

  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claims', '{}', true);

  SELECT amount_cents INTO v_amount
    FROM public.debts WHERE id = 'deb70000-0000-0000-0000-000000000001';

  INSERT INTO test_results VALUES (
    3,
    CASE WHEN v_rows = 0 AND v_amount = 100000 THEN 'PASS' ELSE 'FAIL' END,
    CASE WHEN v_rows = 0 AND v_amount = 100000 THEN 'accept + tamper amount_cents blocked'
         WHEN v_rows > 0 THEN 'tampered amount_cents accepted (amount now ' || v_amount || ')'
         ELSE 'unexpected state (rows=' || v_rows || ', amount=' || v_amount || ')' END
  );
END $t3$;


-- ─────────────────────────────────────────────────────────────
-- TEST 4 — Accept + tamper creator_id (expect PASS: blocked)
-- Bob sets status='accepted' AND creator_id=Bob.
-- Full privilege escalation: Bob would become debt owner.
-- ─────────────────────────────────────────────────────────────

DO $t4$
DECLARE
  v_rows    integer;
  v_creator uuid;
BEGIN
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims',
    '{"sub":"b0b00000-0000-0000-0000-000000000001","role":"authenticated"}', true);

  BEGIN
    UPDATE public.debts
       SET status = 'accepted',
           creator_id = 'b0b00000-0000-0000-0000-000000000001'
     WHERE id = 'deb70000-0000-0000-0000-000000000001';
    GET DIAGNOSTICS v_rows = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    v_rows := 0;
  END;

  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claims', '{}', true);

  SELECT creator_id INTO v_creator
    FROM public.debts WHERE id = 'deb70000-0000-0000-0000-000000000001';

  INSERT INTO test_results VALUES (
    4,
    CASE WHEN v_rows = 0 AND v_creator = 'a1ce0000-0000-0000-0000-000000000001'
         THEN 'PASS' ELSE 'FAIL' END,
    CASE WHEN v_rows = 0 AND v_creator = 'a1ce0000-0000-0000-0000-000000000001'
         THEN 'accept + tamper creator_id blocked'
         WHEN v_rows > 0
         THEN 'creator_id changed to ' || v_creator
         ELSE 'unexpected state (rows=' || v_rows || ')' END
  );
END $t4$;


-- ─────────────────────────────────────────────────────────────
-- TEST 5 — Accept + tamper borrower_user_id (expect PASS: blocked)
-- Bob sets status='accepted' AND borrower_user_id=Charlie.
-- ─────────────────────────────────────────────────────────────

DO $t5$
DECLARE
  v_rows     integer;
  v_borrower uuid;
BEGIN
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims',
    '{"sub":"b0b00000-0000-0000-0000-000000000001","role":"authenticated"}', true);

  BEGIN
    UPDATE public.debts
       SET status = 'accepted',
           borrower_user_id = 'ca1e0000-0000-0000-0000-000000000001'
     WHERE id = 'deb70000-0000-0000-0000-000000000001';
    GET DIAGNOSTICS v_rows = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    v_rows := 0;
  END;

  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claims', '{}', true);

  SELECT borrower_user_id INTO v_borrower
    FROM public.debts WHERE id = 'deb70000-0000-0000-0000-000000000001';

  INSERT INTO test_results VALUES (
    5,
    CASE WHEN v_rows = 0 AND v_borrower = 'b0b00000-0000-0000-0000-000000000001'
         THEN 'PASS' ELSE 'FAIL' END,
    CASE WHEN v_rows = 0 AND v_borrower = 'b0b00000-0000-0000-0000-000000000001'
         THEN 'accept + tamper borrower_user_id blocked'
         WHEN v_rows > 0
         THEN 'borrower_user_id changed to ' || v_borrower
         ELSE 'unexpected state (rows=' || v_rows || ')' END
  );
END $t5$;


-- ─────────────────────────────────────────────────────────────
-- TEST 6 — Accept + tamper group_id (expect PASS: blocked)
-- Bob sets status='accepted' AND group_id=group2 (Bob is not a member).
-- ─────────────────────────────────────────────────────────────

DO $t6$
DECLARE
  v_rows  integer;
  v_group uuid;
BEGIN
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims',
    '{"sub":"b0b00000-0000-0000-0000-000000000001","role":"authenticated"}', true);

  BEGIN
    UPDATE public.debts
       SET status = 'accepted',
           group_id = 'f0000002-0000-0000-0000-000000000001'
     WHERE id = 'deb70000-0000-0000-0000-000000000001';
    GET DIAGNOSTICS v_rows = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    v_rows := 0;
  END;

  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claims', '{}', true);

  SELECT group_id INTO v_group
    FROM public.debts WHERE id = 'deb70000-0000-0000-0000-000000000001';

  INSERT INTO test_results VALUES (
    6,
    CASE WHEN v_rows = 0 AND v_group = 'f0000001-0000-0000-0000-000000000001'
         THEN 'PASS' ELSE 'FAIL' END,
    CASE WHEN v_rows = 0 AND v_group = 'f0000001-0000-0000-0000-000000000001'
         THEN 'accept + tamper group_id blocked'
         WHEN v_rows > 0
         THEN 'group_id changed to ' || v_group
         ELSE 'unexpected state (rows=' || v_rows || ')' END
  );
END $t6$;


-- ─────────────────────────────────────────────────────────────
-- TEST 7 — Creator cannot accept their own debt (expect PASS: blocked)
-- Alice tries to set status='accepted' on her own pending debt.
-- No WITH CHECK passes:
--   creator pending update: status must be in ('pending','rejected')
--   creator undo manual paid: debt_undo_manual_paid_is_valid reads
--     DB → status='pending' not 'paid' → returns false
-- ─────────────────────────────────────────────────────────────

DO $t7$
DECLARE
  v_rows   integer;
  v_status text;
BEGIN
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims',
    '{"sub":"a1ce0000-0000-0000-0000-000000000001","role":"authenticated"}', true);

  BEGIN
    UPDATE public.debts SET status = 'accepted'
     WHERE id = 'deb70000-0000-0000-0000-000000000001';
    GET DIAGNOSTICS v_rows = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    v_rows := 0;
  END;

  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claims', '{}', true);

  SELECT status INTO v_status
    FROM public.debts WHERE id = 'deb70000-0000-0000-0000-000000000001';

  INSERT INTO test_results VALUES (
    7,
    CASE WHEN v_rows = 0 AND v_status = 'pending' THEN 'PASS' ELSE 'FAIL' END,
    CASE WHEN v_rows = 0 AND v_status = 'pending'
         THEN 'creator cannot accept their own debt'
         WHEN v_rows > 0
         THEN 'creator self-accepted (status now ' || v_status || ')'
         ELSE 'unexpected state (rows=' || v_rows || ', status=' || v_status || ')' END
  );
END $t7$;


-- ─────────────────────────────────────────────────────────────
-- RESULTS — returned as the final result set before rollback
-- ─────────────────────────────────────────────────────────────

SELECT test_num, result, detail FROM test_results ORDER BY test_num;

ROLLBACK;
