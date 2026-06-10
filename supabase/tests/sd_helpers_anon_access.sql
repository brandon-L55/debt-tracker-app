-- Tests: migration 20260609000010
-- For each of the 4 SECURITY DEFINER helpers, verify:
--   odd  test number → anon is blocked (permission denied)
--   even test number → authenticated succeeds (no error)

BEGIN;

CREATE TEMP TABLE test_results (
  test_num integer,
  result   text,
  detail   text
) ON COMMIT DROP;

-- ── Setup: insert auth.users + profiles rows needed for authenticated calls ──
DO $setup$
BEGIN
  INSERT INTO auth.users (
    id, aud, role, email,
    encrypted_password, raw_app_meta_data, raw_user_meta_data,
    is_super_admin, created_at, updated_at
  ) VALUES (
    'acc00010-0010-0010-0000-000000000001', 'authenticated', 'authenticated',
    'acc_00010_test@internal', '', '{}', '{}', false, now(), now()
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.profiles (id)
  VALUES ('acc00010-0010-0010-0000-000000000001')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.groups (id, owner_id, name)
  VALUES ('9a000010-0010-0010-0000-000000000001',
          'acc00010-0010-0010-0000-000000000001', 'test group')
  ON CONFLICT (id) DO NOTHING;
END $setup$;


-- ════════════════════════════════════════════════════════════════
-- B. is_group_member
-- ════════════════════════════════════════════════════════════════

DO $t1$
DECLARE v_err text := 'no error';
BEGIN
  SET LOCAL ROLE anon;
  BEGIN
    PERFORM public.is_group_member(
      '9a000010-0010-0010-0000-000000000001',
      'acc00010-0010-0010-0000-000000000001'
    );
  EXCEPTION WHEN OTHERS THEN v_err := SQLERRM; END;
  RESET ROLE;
  INSERT INTO test_results VALUES (
    1,
    CASE WHEN v_err ILIKE '%permission denied%' THEN 'PASS' ELSE 'FAIL' END,
    'is_group_member anon → ' || v_err
  );
END $t1$;

DO $t2$
DECLARE v_err text := 'no error';
BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims',
    '{"sub":"acc00010-0010-0010-0000-000000000001","role":"authenticated"}', true);
  BEGIN
    PERFORM public.is_group_member(
      '9a000010-0010-0010-0000-000000000001',
      'acc00010-0010-0010-0000-000000000001'
    );
  EXCEPTION WHEN OTHERS THEN v_err := SQLERRM; END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '{}', true);
  INSERT INTO test_results VALUES (
    2,
    CASE WHEN v_err = 'no error' THEN 'PASS' ELSE 'FAIL' END,
    'is_group_member authenticated → ' || v_err
  );
END $t2$;


-- ════════════════════════════════════════════════════════════════
-- C. is_group_owner_or_member
-- ════════════════════════════════════════════════════════════════

DO $t3$
DECLARE v_err text := 'no error';
BEGIN
  SET LOCAL ROLE anon;
  BEGIN
    PERFORM public.is_group_owner_or_member(
      '9a000010-0010-0010-0000-000000000001',
      'acc00010-0010-0010-0000-000000000001'
    );
  EXCEPTION WHEN OTHERS THEN v_err := SQLERRM; END;
  RESET ROLE;
  INSERT INTO test_results VALUES (
    3,
    CASE WHEN v_err ILIKE '%permission denied%' THEN 'PASS' ELSE 'FAIL' END,
    'is_group_owner_or_member anon → ' || v_err
  );
END $t3$;

DO $t4$
DECLARE v_err text := 'no error';
BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims',
    '{"sub":"acc00010-0010-0010-0000-000000000001","role":"authenticated"}', true);
  BEGIN
    PERFORM public.is_group_owner_or_member(
      '9a000010-0010-0010-0000-000000000001',
      'acc00010-0010-0010-0000-000000000001'
    );
  EXCEPTION WHEN OTHERS THEN v_err := SQLERRM; END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '{}', true);
  INSERT INTO test_results VALUES (
    4,
    CASE WHEN v_err = 'no error' THEN 'PASS' ELSE 'FAIL' END,
    'is_group_owner_or_member authenticated → ' || v_err
  );
END $t4$;


-- ════════════════════════════════════════════════════════════════
-- D. has_profile_access
-- ════════════════════════════════════════════════════════════════

DO $t5$
DECLARE v_err text := 'no error';
BEGIN
  SET LOCAL ROLE anon;
  BEGIN
    PERFORM public.has_profile_access('acc00010-0010-0010-0000-000000000001');
  EXCEPTION WHEN OTHERS THEN v_err := SQLERRM; END;
  RESET ROLE;
  INSERT INTO test_results VALUES (
    5,
    CASE WHEN v_err ILIKE '%permission denied%' THEN 'PASS' ELSE 'FAIL' END,
    'has_profile_access anon → ' || v_err
  );
END $t5$;

DO $t6$
DECLARE v_err text := 'no error';
BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims',
    '{"sub":"acc00010-0010-0010-0000-000000000001","role":"authenticated"}', true);
  BEGIN
    PERFORM public.has_profile_access('acc00010-0010-0010-0000-000000000001');
  EXCEPTION WHEN OTHERS THEN v_err := SQLERRM; END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '{}', true);
  INSERT INTO test_results VALUES (
    6,
    CASE WHEN v_err = 'no error' THEN 'PASS' ELSE 'FAIL' END,
    'has_profile_access authenticated → ' || v_err
  );
END $t6$;


-- ════════════════════════════════════════════════════════════════
-- E. nudge_recipient_can_update
-- ════════════════════════════════════════════════════════════════

DO $t7$
DECLARE v_err text := 'no error';
BEGIN
  SET LOCAL ROLE anon;
  BEGIN
    PERFORM public.nudge_recipient_can_update(
      gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
      0, null, null, null, null
    );
  EXCEPTION WHEN OTHERS THEN v_err := SQLERRM; END;
  RESET ROLE;
  INSERT INTO test_results VALUES (
    7,
    CASE WHEN v_err ILIKE '%permission denied%' THEN 'PASS' ELSE 'FAIL' END,
    'nudge_recipient_can_update anon → ' || v_err
  );
END $t7$;

DO $t8$
DECLARE v_err text := 'no error';
BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims',
    '{"sub":"acc00010-0010-0010-0000-000000000001","role":"authenticated"}', true);
  BEGIN
    PERFORM public.nudge_recipient_can_update(
      gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
      0, null, null, null, null
    );
  EXCEPTION WHEN OTHERS THEN v_err := SQLERRM; END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '{}', true);
  INSERT INTO test_results VALUES (
    8,
    CASE WHEN v_err = 'no error' THEN 'PASS' ELSE 'FAIL' END,
    'nudge_recipient_can_update authenticated → ' || v_err
  );
END $t8$;


SELECT test_num, result, detail FROM test_results ORDER BY test_num;

ROLLBACK;
