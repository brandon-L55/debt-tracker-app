SELECT grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND specific_name LIKE '%find_profile_by_email%';
