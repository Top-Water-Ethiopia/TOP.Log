-- Verify that the RLS fix was applied correctly
-- Run this in Supabase SQL Editor to check if everything is set up

-- Test 1: Verify the function exists
SELECT 
  'Function exists' as test,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_proc 
      WHERE proname = 'is_admin_or_super_admin'
    ) THEN '✅ Function exists'
    ELSE '❌ Function NOT found'
  END as status;

-- Test 2: Test the function with your user_id
SELECT 
  'Function test' as test,
  public.is_admin_or_super_admin('ccb4613c-3e6d-4421-8b1c-3277280d658c'::UUID) as function_result,
  CASE 
    WHEN public.is_admin_or_super_admin('ccb4613c-3e6d-4421-8b1c-3277280d658c'::UUID) 
    THEN '✅ Function returns TRUE - INSERT will work!'
    ELSE '❌ Function returns FALSE - Check your profile'
  END as status;

-- Test 3: Verify role_questions INSERT policy uses the function
SELECT 
  'role_questions INSERT policy' as test,
  policyname,
  cmd,
  with_check as policy_check,
  CASE 
    WHEN with_check LIKE '%is_admin_or_super_admin%' THEN '✅ Policy uses function'
    ELSE '❌ Policy does NOT use function'
  END as status
FROM pg_policies
WHERE tablename = 'role_questions'
  AND cmd = 'INSERT';

-- Test 4: Verify user_profiles SELECT policy exists
SELECT 
  'user_profiles SELECT policy' as test,
  policyname,
  cmd,
  CASE 
    WHEN policyname = 'Users can view their own profile' THEN '✅ Policy exists'
    ELSE '❌ Policy missing'
  END as status
FROM pg_policies
WHERE tablename = 'user_profiles'
  AND cmd = 'SELECT';

