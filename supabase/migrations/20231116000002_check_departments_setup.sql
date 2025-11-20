-- Diagnostic script to check departments table setup
-- Run this in your Supabase SQL Editor to verify everything is configured correctly

-- 1. Check if departments table exists
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'departments'
  ) THEN
    RAISE NOTICE '✅ Departments table exists';
  ELSE
    RAISE EXCEPTION '❌ Departments table does not exist. Run migration: 20231116000000_create_departments_table.sql';
  END IF;
END $$;

-- 2. Check if is_admin() function exists
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM pg_proc 
    WHERE proname = 'is_admin' 
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    RAISE NOTICE '✅ is_admin() function exists';
  ELSE
    RAISE EXCEPTION '❌ is_admin() function does not exist. Run migration: 20231116000001_fix_departments_rls_policies.sql';
  END IF;
END $$;

-- 3. Check RLS is enabled
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'departments' 
    AND rowsecurity = true
  ) THEN
    RAISE NOTICE '✅ RLS is enabled on departments table';
  ELSE
    RAISE WARNING '⚠️  RLS is not enabled on departments table';
  END IF;
END $$;

-- 4. Check RLS policies exist
DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public' 
  AND tablename = 'departments';
  
  IF policy_count >= 5 THEN
    RAISE NOTICE '✅ Found % RLS policies on departments table', policy_count;
  ELSE
    RAISE WARNING '⚠️  Expected at least 5 RLS policies, found %', policy_count;
  END IF;
END $$;

-- 5. List all RLS policies on departments
SELECT 
  policyname as "Policy Name",
  cmd as "Command",
  qual as "USING Expression",
  with_check as "WITH CHECK Expression"
FROM pg_policies
WHERE schemaname = 'public' 
AND tablename = 'departments'
ORDER BY policyname;

-- 6. Test is_admin() function (will show true/false for current user)
SELECT 
  auth.uid() as "Current User ID",
  is_admin() as "Is Admin",
  CASE 
    WHEN is_admin() THEN '✅ You are recognized as admin'
    ELSE '❌ You are NOT recognized as admin - check your role_id in user_profiles'
  END as "Status";

-- 7. Check current user's profile and role
SELECT 
  up.user_id as "User ID",
  up.name as "Name",
  up.role_id as "Role ID",
  r.name as "Role Name",
  up.is_active as "Is Active",
  CASE 
    WHEN up.role_id = '00000000-0000-0000-0000-000000000001' THEN '✅ Admin role'
    ELSE '❌ Not admin role'
  END as "Admin Status"
FROM user_profiles up
LEFT JOIN roles r ON r.id = up.role_id
WHERE up.user_id = auth.uid();

-- 8. Check if user_profiles table has RLS that might block is_admin()
SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public' 
AND tablename = 'user_profiles'
ORDER BY policyname;

-- 9. Summary
DO $$
DECLARE
  table_exists BOOLEAN;
  function_exists BOOLEAN;
  rls_enabled BOOLEAN;
  policy_count INTEGER;
  user_is_admin BOOLEAN;
BEGIN
  -- Check table
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'departments'
  ) INTO table_exists;
  
  -- Check function
  SELECT EXISTS (
    SELECT FROM pg_proc 
    WHERE proname = 'is_admin' 
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) INTO function_exists;
  
  -- Check RLS
  SELECT rowsecurity INTO rls_enabled
  FROM pg_tables 
  WHERE schemaname = 'public' 
  AND tablename = 'departments';
  
  -- Count policies
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public' 
  AND tablename = 'departments';
  
  -- Check if current user is admin
  SELECT is_admin() INTO user_is_admin;
  
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE 'DEPARTMENTS SETUP DIAGNOSTIC SUMMARY';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE 'Table exists: %', CASE WHEN table_exists THEN '✅ YES' ELSE '❌ NO' END;
  RAISE NOTICE 'is_admin() function exists: %', CASE WHEN function_exists THEN '✅ YES' ELSE '❌ NO' END;
  RAISE NOTICE 'RLS enabled: %', CASE WHEN rls_enabled THEN '✅ YES' ELSE '❌ NO' END;
  RAISE NOTICE 'RLS policies count: %', policy_count;
  RAISE NOTICE 'Current user is admin: %', CASE WHEN user_is_admin THEN '✅ YES' ELSE '❌ NO' END;
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  
  IF table_exists AND function_exists AND rls_enabled AND policy_count >= 5 AND user_is_admin THEN
    RAISE NOTICE '✅ ALL CHECKS PASSED - Setup is correct!';
  ELSE
    RAISE WARNING '⚠️  SOME CHECKS FAILED - Review the output above';
  END IF;
END $$;







