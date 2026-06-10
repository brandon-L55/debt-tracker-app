-- =============================================================
-- Tests: migration 20260609000007
--        create_group_debts() must derive status from linked_user_id,
--        not from any caller-supplied status field in the JSONB.
--
-- Run as postgres (superuser) in the Supabase SQL editor or psql.
-- All changes roll back at the end — safe to run against any environment.
--
-- Expected output (5 rows, all PASS):
--   1  PASS  linked app user → pending
--   2  PASS  manual contact → accepted
--   3  PASS  caller status='paid' ignored for manual contact → accepted
--   4  PASS  caller status='accepted' ignored for linked user → pending
--   5  PASS  caller status='rejected' ignored for linked user → pending
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
-- p_group_id=NULL is passed to all RPC calls so no group or
-- group_members rows are needed (the membership check is skipped).

DO $setup$
DECLARE
  v_alice_id CONSTANT uuid := 'a1ce0005-0007-0007-0000-000000000001';
  v_bob_id   CONSTANT uuid := 'b0b00005-0007-0007-0000-000000000001';
BEGIN
  INSERT INTO auth.users (
    id, aud, role, email,
    encrypted_password,
    raw_app_meta_data, raw_user_meta_data,
    is_super_admin, created_at, updated_at
  ) VALUES
    (v_alice_id, 'authenticated', 'authenticated',
     'alice_00007_test@internal',
     '', '{}', '{}', false, now(), now()),
    (v_bob_id,   'authenticated', 'authenticated',
     'bob_00007_test@internal',
     '', '{}', '{}', false, now(), now())
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.profiles (id)
  VALUES (v_alice_id), (v_bob_id)
  ON CONFLICT (id) DO NOTHING;

  -- Bob's contact: linked to his app account (owned by Alice).
  INSERT INTO public.contacts (id, owner_id, name, linked_user_id)
  VALUES (
    'c0b00005-0007-0007-0000-000000000001',
    v_alice_id,
    'Bob',
    v_bob_id
  ) ON CONFLICT (id) DO NOTHING;

  -- Charlie's contact: manual, no app account (owned by Alice).
  INSERT INTO public.contacts (id, owner_id, name)
  VALUES (
    'c0c00005-0007-0007-0000-000000000001',
    v_alice_id,
    'Charlie'
  ) ON CONFLICT (id) DO NOTHING;
END $setup$;


-- ─────────────────────────────────────────────────────────────
-- TEST 1 — Linked app user → status must be 'pending'
-- No status key in the JSON; RPC derives from linked_user_id.
-- ─────────────────────────────────────────────────────────────

DO $t1$
DECLARE
  v_result  jsonb;
  v_debt_id uuid;
  v_status  text;
BEGIN
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims',
    '{"sub":"a1ce0005-0007-0007-0000-000000000001","role":"authenticated"}', true);

  SELECT public.create_group_debts(
    null,
    'test debt',
    null,
    'them',
    '[{"contact_id":"c0b00005-0007-0007-0000-000000000001",
       "linked_user_id":"b0b00005-0007-0007-0000-000000000001",
       "amount_cents":1000,
       "client_request_id":"t7-t1-linked-no-status"}]'::jsonb
  ) INTO v_result;

  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claims', '{}', true);

  v_debt_id := ((v_result->'ids')->>0)::uuid;
  SELECT status INTO v_status FROM public.debts WHERE id = v_debt_id;

  INSERT INTO test_results VALUES (
    1,
    CASE WHEN v_status = 'pending' THEN 'PASS' ELSE 'FAIL' END,
    'linked app user → status=' || coalesce(v_status, 'NULL') || ' (expected pending)'
  );
END $t1$;


-- ─────────────────────────────────────────────────────────────
-- TEST 2 — Manual contact → status must be 'accepted'
-- No status key in the JSON; RPC derives from linked_user_id=NULL.
-- ─────────────────────────────────────────────────────────────

DO $t2$
DECLARE
  v_result  jsonb;
  v_debt_id uuid;
  v_status  text;
BEGIN
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims',
    '{"sub":"a1ce0005-0007-0007-0000-000000000001","role":"authenticated"}', true);

  SELECT public.create_group_debts(
    null,
    'test debt',
    null,
    'them',
    '[{"contact_id":"c0c00005-0007-0007-0000-000000000001",
       "linked_user_id":null,
       "amount_cents":1000,
       "client_request_id":"t7-t2-manual-no-status"}]'::jsonb
  ) INTO v_result;

  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claims', '{}', true);

  v_debt_id := ((v_result->'ids')->>0)::uuid;
  SELECT status INTO v_status FROM public.debts WHERE id = v_debt_id;

  INSERT INTO test_results VALUES (
    2,
    CASE WHEN v_status = 'accepted' THEN 'PASS' ELSE 'FAIL' END,
    'manual contact → status=' || coalesce(v_status, 'NULL') || ' (expected accepted)'
  );
END $t2$;


-- ─────────────────────────────────────────────────────────────
-- TEST 3 — Caller passes status='paid' for manual contact.
-- RPC must ignore it and use 'accepted' (linked_user_id=NULL).
-- ─────────────────────────────────────────────────────────────

DO $t3$
DECLARE
  v_result  jsonb;
  v_debt_id uuid;
  v_status  text;
BEGIN
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims',
    '{"sub":"a1ce0005-0007-0007-0000-000000000001","role":"authenticated"}', true);

  SELECT public.create_group_debts(
    null,
    'test debt',
    null,
    'them',
    '[{"contact_id":"c0c00005-0007-0007-0000-000000000001",
       "linked_user_id":null,
       "amount_cents":1000,
       "status":"paid",
       "client_request_id":"t7-t3-manual-paid"}]'::jsonb
  ) INTO v_result;

  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claims', '{}', true);

  v_debt_id := ((v_result->'ids')->>0)::uuid;
  SELECT status INTO v_status FROM public.debts WHERE id = v_debt_id;

  INSERT INTO test_results VALUES (
    3,
    CASE WHEN v_status = 'accepted' THEN 'PASS' ELSE 'FAIL' END,
    'caller status=''paid'' ignored for manual contact → status='
      || coalesce(v_status, 'NULL') || ' (expected accepted)'
  );
END $t3$;


-- ─────────────────────────────────────────────────────────────
-- TEST 4 — Caller passes status='accepted' for linked app user.
-- RPC must ignore it and use 'pending' (linked_user_id IS NOT NULL).
-- ─────────────────────────────────────────────────────────────

DO $t4$
DECLARE
  v_result  jsonb;
  v_debt_id uuid;
  v_status  text;
BEGIN
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims',
    '{"sub":"a1ce0005-0007-0007-0000-000000000001","role":"authenticated"}', true);

  SELECT public.create_group_debts(
    null,
    'test debt',
    null,
    'them',
    '[{"contact_id":"c0b00005-0007-0007-0000-000000000001",
       "linked_user_id":"b0b00005-0007-0007-0000-000000000001",
       "amount_cents":1000,
       "status":"accepted",
       "client_request_id":"t7-t4-linked-accepted"}]'::jsonb
  ) INTO v_result;

  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claims', '{}', true);

  v_debt_id := ((v_result->'ids')->>0)::uuid;
  SELECT status INTO v_status FROM public.debts WHERE id = v_debt_id;

  INSERT INTO test_results VALUES (
    4,
    CASE WHEN v_status = 'pending' THEN 'PASS' ELSE 'FAIL' END,
    'caller status=''accepted'' ignored for linked user → status='
      || coalesce(v_status, 'NULL') || ' (expected pending)'
  );
END $t4$;


-- ─────────────────────────────────────────────────────────────
-- TEST 5 — Caller passes status='rejected' for linked app user.
-- RPC must ignore it and use 'pending' (linked_user_id IS NOT NULL).
-- ─────────────────────────────────────────────────────────────

DO $t5$
DECLARE
  v_result  jsonb;
  v_debt_id uuid;
  v_status  text;
BEGIN
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims',
    '{"sub":"a1ce0005-0007-0007-0000-000000000001","role":"authenticated"}', true);

  SELECT public.create_group_debts(
    null,
    'test debt',
    null,
    'them',
    '[{"contact_id":"c0b00005-0007-0007-0000-000000000001",
       "linked_user_id":"b0b00005-0007-0007-0000-000000000001",
       "amount_cents":1000,
       "status":"rejected",
       "client_request_id":"t7-t5-linked-rejected"}]'::jsonb
  ) INTO v_result;

  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claims', '{}', true);

  v_debt_id := ((v_result->'ids')->>0)::uuid;
  SELECT status INTO v_status FROM public.debts WHERE id = v_debt_id;

  INSERT INTO test_results VALUES (
    5,
    CASE WHEN v_status = 'pending' THEN 'PASS' ELSE 'FAIL' END,
    'caller status=''rejected'' ignored for linked user → status='
      || coalesce(v_status, 'NULL') || ' (expected pending)'
  );
END $t5$;


-- ─────────────────────────────────────────────────────────────
-- RESULTS
-- ─────────────────────────────────────────────────────────────

SELECT test_num, result, detail FROM test_results ORDER BY test_num;

ROLLBACK;
