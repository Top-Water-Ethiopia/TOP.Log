-- Verify and Fix RLS Policies
-- This checks if RLS is actually working and fixes any issues

BEGIN;

-- ============================================================================
-- PART 1: Verify and Fix user_profiles RLS
-- ============================================================================

-- Check if RLS is enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled,
  CASE 
    WHEN rowsecurity THEN '✅ RLS Enabled'
    ELSE '❌ RLS Disabled'
  END as status
FROM pg_tables
WHERE tablename = 'user_profiles';

-- Drop all existing SELECT policies
DO $$
DECLARE
  policy_record RECORD;
BEGIN
  FOR policy_record IN
    SELECT policyname 
    FROM pg_policies 
    WHERE tablename = 'user_profiles' 
    AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON user_profiles', policy_record.policyname);
    RAISE NOTICE 'Dropped policy: %', policy_record.policyname;
  END LOOP;
END $$;

-- Ensure RLS is enabled
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Create the policy with explicit schema
CREATE POLICY "Users can view their own profile"
  ON public.user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- PART 2: Verify and Fix role_questions RLS
-- ============================================================================

-- Check if RLS is enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled,
  CASE 
    WHEN rowsecurity THEN '✅ RLS Enabled'
    ELSE '❌ RLS Disabled'
  END as status
FROM pg_tables
WHERE tablename = 'role_questions';

-- Ensure RLS is enabled
ALTER TABLE role_questions ENABLE ROW LEVEL SECURITY;

-- Drop existing INSERT policy
DROP POLICY IF EXISTS "Admins can create role questions" ON role_questions;

-- Recreate the INSERT policy with explicit schema references
CREATE POLICY "Admins can create role questions"
  ON public.role_questions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.is_active = true
      AND (
        user_profiles.role_id = '00000000-0000-0000-0000-000000000001'::UUID
        OR user_profiles.role_id = '00000000-0000-0000-0000-000000000000'::UUID
      )
    )
  );

COMMIT;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify user_profiles policy
SELECT 
  'user_profiles' as table_name,
  policyname,
  cmd,
  qual as policy_condition
FROM pg_policies
WHERE tablename = 'user_profiles'
  AND cmd = 'SELECT';

-- Verify role_questions INSERT policy
SELECT 
  'role_questions' as table_name,
  policyname,
  cmd,
  with_check as policy_condition
FROM pg_policies
WHERE tablename = 'role_questions'
  AND cmd = 'INSERT';

-- Test: This should work now
-- This simulates what the INSERT policy checks
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.user_id = 'ccb4613c-3e6d-4421-8b1c-3277280d658c'
      AND user_profiles.is_active = true
      AND (
        user_profiles.role_id = '00000000-0000-0000-0000-000000000001'::UUID
        OR user_profiles.role_id = '00000000-0000-0000-0000-000000000000'::UUID
      )
    ) THEN '✅ INSERT check would PASS'
    ELSE '❌ INSERT check would FAIL'
  END as test_result;

