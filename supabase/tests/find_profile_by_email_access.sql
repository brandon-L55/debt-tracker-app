-- Tests: migration 20260609000008
--   1. anon role cannot execute find_profile_by_email → permission denied
--   2. authenticated role can execute find_profile_by_email → no error

BEGIN;

CREATE TEMP TABLE test_results (
  test_num integer,
  result   text,
  detail   text
) ON COMMIT DROP;

-- ── TEST 1: anon cannot call find_profile_by_email ────────────────────────
DO $t1$
DECLARE
  v_error text := 'no error';
BEGIN
  SET LOCAL ROLE anon;

  BEGIN
    PERFORM public.find_profile_by_email('anything@example.com');
    v_error := 'no error';
  EXCEPTION WHEN OTHERS THEN
    v_error := SQLERRM;
  END;

  RESET ROLE;

  INSERT INTO test_results VALUES (
    1,
    CASE WHEN v_error ILIKE '%permission denied%' THEN 'PASS' ELSE 'FAIL' END,
    'anon execute → ' || v_error
  );
END $t1$;

-- ── TEST 2: authenticated can still call find_profile_by_email ────────────
DO $t2$
DECLARE
  v_error text := 'no error';
BEGIN
  INSERT INTO auth.users (
    id, aud, role, email,
    encrypted_password, raw_app_meta_data, raw_user_meta_data,
    is_super_admin, created_at, updated_at
  ) VALUES (
    'f1d00001-0008-0008-0000-000000000001', 'authenticated', 'authenticated',
    'findtest_00008@internal',
    '', '{}', '{}', false, now(), now()
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.profiles (id, email, display_name)
  VALUES ('f1d00001-0008-0008-0000-000000000001', 'findtest_00008@internal', 'Find Test')
  ON CONFLICT (id) DO NOTHING;

  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims',
    '{"sub":"f1d00001-0008-0008-0000-000000000001","role":"authenticated"}', true);

  BEGIN
    PERFORM public.find_profile_by_email('findtest_00008@internal');
    v_error := 'no error';
  EXCEPTION WHEN OTHERS THEN
    v_error := SQLERRM;
  END;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '{}', true);

  INSERT INTO test_results VALUES (
    2,
    CASE WHEN v_error = 'no error' THEN 'PASS' ELSE 'FAIL' END,
    'authenticated execute → ' || v_error
  );
END $t2$;

SELECT test_num, result, detail FROM test_results ORDER BY test_num;

ROLLBACK;
