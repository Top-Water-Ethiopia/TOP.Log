-- Test script for is_admin() function
-- Run this in Supabase SQL Editor to debug why is_admin() returns false

-- Step 1: Check current user
DO $$
DECLARE
  current_user_id UUID;
  user_email TEXT;
BEGIN
  current_user_id := auth.uid();
  SELECT email INTO user_email FROM auth.users WHERE id = current_user_id;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Testing is_admin() Function';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Step 1: Current User';
  RAISE NOTICE '  User ID: %', current_user_id;
  RAISE NOTICE '  Email: %', COALESCE(user_email, 'Not found');
  
  IF current_user_id IS NULL THEN
    RAISE NOTICE '';
    RAISE NOTICE '❌ ERROR: No authenticated user found!';
    RAISE NOTICE '   Make sure you are logged in.';
    RETURN;
  END IF;
END $$;

-- Step 2: Check user profile
DO $$
DECLARE
  current_user_id UUID;
  profile_record RECORD;
  admin_role_id UUID := '00000000-0000-0000-0000-000000000001'::UUID;
BEGIN
  current_user_id := auth.uid();
  
  SELECT * INTO profile_record
  FROM user_profiles
  WHERE user_id = current_user_id;
  
  RAISE NOTICE '';
  RAISE NOTICE 'Step 2: User Profile';
  
  IF NOT FOUND THEN
    RAISE NOTICE '  ❌ ERROR: User profile does not exist!';
    RAISE NOTICE '  This is likely the problem.';
    RAISE NOTICE '';
    RAISE NOTICE '  To fix, run:';
    RAISE NOTICE '  INSERT INTO user_profiles (user_id, name, role_id, is_active)';
    RAISE NOTICE '  VALUES (auth.uid(), ''User'', ''%'', true);', admin_role_id;
    RETURN;
  END IF;
  
  RAISE NOTICE '  ✅ Profile found:';
  RAISE NOTICE '    Name: %', profile_record.name;
  RAISE NOTICE '    Role ID: %', profile_record.role_id;
  RAISE NOTICE '    Is Active: %', profile_record.is_active;
  RAISE NOTICE '    Department: %', COALESCE(profile_record.department, 'N/A');
  
  -- Check if role_id matches admin
  IF profile_record.role_id = admin_role_id THEN
    RAISE NOTICE '    ✅ Role ID matches admin role ID';
  ELSE
    RAISE NOTICE '    ❌ Role ID does NOT match admin role ID';
    RAISE NOTICE '    Expected: %', admin_role_id;
    RAISE NOTICE '    Actual: %', profile_record.role_id;
    RAISE NOTICE '';
    RAISE NOTICE '    To fix, run:';
    RAISE NOTICE '    UPDATE user_profiles';
    RAISE NOTICE '    SET role_id = ''%''', admin_role_id;
    RAISE NOTICE '    WHERE user_id = auth.uid();';
  END IF;
  
  IF NOT profile_record.is_active THEN
    RAISE NOTICE '    ⚠️  WARNING: User profile is not active!';
    RAISE NOTICE '    To fix, run:';
    RAISE NOTICE '    UPDATE user_profiles SET is_active = true WHERE user_id = auth.uid();';
  END IF;
END $$;

-- Step 3: Check role details
DO $$
DECLARE
  current_user_id UUID;
  profile_role_id UUID;
  role_record RECORD;
BEGIN
  current_user_id := auth.uid();
  
  SELECT role_id INTO profile_role_id
  FROM user_profiles
  WHERE user_id = current_user_id;
  
  IF profile_role_id IS NULL THEN
    RETURN;
  END IF;
  
  SELECT * INTO role_record
  FROM roles
  WHERE id = profile_role_id;
  
  RAISE NOTICE '';
  RAISE NOTICE 'Step 3: Role Details';
  
  IF NOT FOUND THEN
    RAISE NOTICE '  ⚠️  Role not found for role_id: %', profile_role_id;
    RETURN;
  END IF;
  
  RAISE NOTICE '  ✅ Role found:';
  RAISE NOTICE '    Role Name: %', role_record.name;
  RAISE NOTICE '    Role ID: %', role_record.id;
  RAISE NOTICE '    Description: %', COALESCE(role_record.description, 'N/A');
END $$;

-- Step 4: Test is_admin() function
DO $$
DECLARE
  current_user_id UUID;
  profile_role_id UUID;
  admin_role_id UUID := '00000000-0000-0000-0000-000000000001'::UUID;
  is_admin_result BOOLEAN;
  expected_result BOOLEAN;
  function_error TEXT;
BEGIN
  current_user_id := auth.uid();
  
  SELECT role_id INTO profile_role_id
  FROM user_profiles
  WHERE user_id = current_user_id
    AND is_active = true;
  
  expected_result := (profile_role_id = admin_role_id);
  
  RAISE NOTICE '';
  RAISE NOTICE 'Step 4: Testing is_admin() Function';
  
  BEGIN
    SELECT is_admin() INTO is_admin_result;
    function_error := NULL;
  EXCEPTION WHEN OTHERS THEN
    function_error := SQLERRM;
    is_admin_result := NULL;
  END;
  
  IF function_error IS NOT NULL THEN
    RAISE NOTICE '  ❌ ERROR calling is_admin():';
    RAISE NOTICE '    %', function_error;
    RAISE NOTICE '';
    RAISE NOTICE '  Possible causes:';
    RAISE NOTICE '    1. Function does not exist';
    RAISE NOTICE '    2. Function has permission issues';
    RAISE NOTICE '    3. Function has syntax errors';
    RETURN;
  END IF;
  
  RAISE NOTICE '  Function Result: %', is_admin_result;
  RAISE NOTICE '  Expected Result: %', expected_result;
  
  IF is_admin_result = expected_result THEN
    RAISE NOTICE '  ✅ Function result matches expected value';
  ELSE
    RAISE NOTICE '  ❌ Function result does NOT match expected value!';
    RAISE NOTICE '  This indicates a problem with the is_admin() function.';
    RAISE NOTICE '';
    RAISE NOTICE '  Possible issues:';
    RAISE NOTICE '    1. Function cannot read user_profiles (RLS blocking)';
    RAISE NOTICE '    2. Function logic is incorrect';
    RAISE NOTICE '    3. Function is not using SECURITY DEFINER correctly';
  END IF;
END $$;

-- Step 5: Direct query test (bypassing function)
DO $$
DECLARE
  current_user_id UUID;
  admin_role_id UUID := '00000000-0000-0000-0000-000000000001'::UUID;
  direct_check BOOLEAN;
BEGIN
  current_user_id := auth.uid();
  
  RAISE NOTICE '';
  RAISE NOTICE 'Step 5: Direct Query Test (Bypassing Function)';
  
  SELECT EXISTS (
    SELECT 1 
    FROM user_profiles
    WHERE user_id = current_user_id
      AND role_id = admin_role_id
      AND is_active = true
  ) INTO direct_check;
  
  RAISE NOTICE '  Direct query result: %', direct_check;
  
  IF direct_check THEN
    RAISE NOTICE '  ✅ Direct query confirms user IS admin';
    RAISE NOTICE '  If is_admin() returns false, the function has an issue.';
  ELSE
    RAISE NOTICE '  ❌ Direct query confirms user is NOT admin';
    RAISE NOTICE '  This matches the expected behavior.';
  END IF;
END $$;

-- Step 6: Check function definition
DO $$
DECLARE
  function_def TEXT;
  function_owner TEXT;
  function_security TEXT;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'Step 6: Function Definition Check';
  
  SELECT 
    pg_get_functiondef(oid)::TEXT,
    pg_get_userbyid(proowner)::TEXT,
    CASE 
      WHEN prosecdef THEN 'SECURITY DEFINER'
      ELSE 'SECURITY INVOKER'
    END
  INTO function_def, function_owner, function_security
  FROM pg_proc
  WHERE proname = 'is_admin'
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  LIMIT 1;
  
  IF function_def IS NULL THEN
    RAISE NOTICE '  ❌ Function is_admin() does not exist!';
    RAISE NOTICE '  You need to create it.';
    RETURN;
  END IF;
  
  RAISE NOTICE '  ✅ Function exists:';
  RAISE NOTICE '    Owner: %', function_owner;
  RAISE NOTICE '    Security: %', function_security;
  
  IF function_security != 'SECURITY DEFINER' THEN
    RAISE NOTICE '  ⚠️  WARNING: Function is not SECURITY DEFINER!';
    RAISE NOTICE '  This may cause RLS issues.';
  END IF;
  
  -- Show first few lines of function
  RAISE NOTICE '';
  RAISE NOTICE '  Function definition (first 500 chars):';
  RAISE NOTICE '  %', LEFT(function_def, 500);
END $$;

-- Step 7: Summary and recommendations
DO $$
DECLARE
  current_user_id UUID;
  profile_exists BOOLEAN;
  is_admin_by_role BOOLEAN;
  is_admin_by_function BOOLEAN;
  admin_role_id UUID := '00000000-0000-0000-0000-000000000001'::UUID;
BEGIN
  current_user_id := auth.uid();
  
  SELECT EXISTS (
    SELECT 1 FROM user_profiles WHERE user_id = current_user_id
  ) INTO profile_exists;
  
  SELECT EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_id = current_user_id
      AND role_id = admin_role_id
      AND is_active = true
  ) INTO is_admin_by_role;
  
  BEGIN
    SELECT is_admin() INTO is_admin_by_function;
  EXCEPTION WHEN OTHERS THEN
    is_admin_by_function := NULL;
  END;
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Summary';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Profile exists: %', CASE WHEN profile_exists THEN '✅ YES' ELSE '❌ NO' END;
  RAISE NOTICE 'Is admin (by role): %', CASE WHEN is_admin_by_role THEN '✅ YES' ELSE '❌ NO' END;
  RAISE NOTICE 'Is admin (by function): %', 
    CASE 
      WHEN is_admin_by_function IS NULL THEN '❌ ERROR'
      WHEN is_admin_by_function THEN '✅ YES'
      ELSE '❌ NO'
    END;
  RAISE NOTICE '';
  
  IF NOT profile_exists THEN
    RAISE NOTICE '❌ ISSUE: User profile does not exist';
    RAISE NOTICE '   Fix: Create a profile for this user';
  ELSIF NOT is_admin_by_role THEN
    RAISE NOTICE '❌ ISSUE: User role_id is not admin';
    RAISE NOTICE '   Fix: Update role_id to admin role';
  ELSIF is_admin_by_function IS NULL THEN
    RAISE NOTICE '❌ ISSUE: is_admin() function has an error';
    RAISE NOTICE '   Fix: Check function definition and permissions';
  ELSIF is_admin_by_role AND NOT is_admin_by_function THEN
    RAISE NOTICE '❌ ISSUE: is_admin() returns false even though user is admin';
    RAISE NOTICE '   Fix: Function may have RLS or logic issues';
  ELSIF is_admin_by_role AND is_admin_by_function THEN
    RAISE NOTICE '✅ SUCCESS: Everything is working correctly!';
  ELSE
    RAISE NOTICE '✅ Expected: User is not admin, function returns false';
  END IF;
  
  RAISE NOTICE '';
END $$;







