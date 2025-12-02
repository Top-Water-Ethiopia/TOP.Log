-- Test RLS Policies for Super Admin
-- Run this in Supabase SQL Editor to verify if policies are working
-- Replace 'ccb4613c-3e6d-4421-8b1c-3277280d658c' with your user_id below

-- Step 1: Check if role_questions INSERT policy exists
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'role_questions'
  AND cmd = 'INSERT'
ORDER BY policyname;

-- Step 3: Check user_profiles RLS policies
-- These must allow reading your own profile for the EXISTS check to work
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'user_profiles'
  AND cmd = 'SELECT'
ORDER BY policyname;

-- Step 2: Direct test of the profile check
-- Replace 'ccb4613c-3e6d-4421-8b1c-3277280d658c' with your user_id
SELECT 
  up.id,
  up.user_id,
  up.role_id,
  r.name as role_name,
  up.is_active,
  CASE 
    WHEN up.role_id = '00000000-0000-0000-0000-000000000000'::UUID THEN 'Super Admin ✓'
    WHEN up.role_id = '00000000-0000-0000-0000-000000000001'::UUID THEN 'Admin ✓'
    ELSE 'Other Role ✗'
  END as role_status,
  CASE 
    WHEN up.is_active = true THEN 'Active ✓'
    ELSE 'Inactive ✗'
  END as active_status,
  CASE 
    WHEN (up.role_id = '00000000-0000-0000-0000-000000000000'::UUID OR up.role_id = '00000000-0000-0000-0000-000000000001'::UUID)
         AND up.is_active = true 
    THEN '✅ Would PASS INSERT check'
    ELSE '❌ Would FAIL INSERT check'
  END as insert_check_result
FROM user_profiles up
LEFT JOIN roles r ON r.id = up.role_id
WHERE up.user_id = 'ccb4613c-3e6d-4421-8b1c-3277280d658c'; -- ⚠️ Replace with your user_id

-- Step 3: Test if the INSERT policy check logic would work
-- Replace 'ccb4613c-3e6d-4421-8b1c-3277280d658c' with your user_id
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = 'ccb4613c-3e6d-4421-8b1c-3277280d658c' -- ⚠️ Replace with your user_id
      AND (role_id = '00000000-0000-0000-0000-000000000001'::UUID
           OR role_id = '00000000-0000-0000-0000-000000000000'::UUID)
      AND is_active = true
    ) THEN '✅ INSERT check logic would PASS'
    ELSE '❌ INSERT check logic would FAIL'
  END as insert_check_test;

