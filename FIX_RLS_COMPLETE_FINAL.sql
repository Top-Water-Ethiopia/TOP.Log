-- Complete RLS Fix: Ensure user_profiles RLS works in EXISTS context
-- The issue: When role_questions policy checks user_profiles, it must work
-- Run this in Supabase SQL Editor

BEGIN;

-- ============================================================================
-- STEP 1: Fix user_profiles RLS (CRITICAL - must work in EXISTS context)
-- ============================================================================

-- Drop ALL existing SELECT policies on user_profiles
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
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Create the simplest possible policy - this MUST work for EXISTS checks
-- No schema prefix needed here since we're in public schema
CREATE POLICY "Users can view their own profile"
  ON public.user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- STEP 2: Apply exact departments pattern to role_questions
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view questions for their role" ON role_questions;
DROP POLICY IF EXISTS "Admins can view all role questions" ON role_questions;
DROP POLICY IF EXISTS "Admins can create role questions" ON role_questions;
DROP POLICY IF EXISTS "Admins can update role questions" ON role_questions;
DROP POLICY IF EXISTS "Admins can delete role questions" ON role_questions;

-- Ensure RLS is enabled
ALTER TABLE public.role_questions ENABLE ROW LEVEL SECURITY;

-- Users can view active questions for their role
CREATE POLICY "Users can view questions for their role"
  ON public.role_questions FOR SELECT
  TO authenticated
  USING (
    is_active = true AND
    role_id IN (
      SELECT role_id FROM public.user_profiles WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Admins and super admins can view all questions
-- EXACT COPY FROM departments - note: uses user_profiles without schema prefix
CREATE POLICY "Admins can view all role questions"
  ON public.role_questions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_id = auth.uid()
      AND (role_id = '00000000-0000-0000-0000-000000000001' -- Admin role
           OR role_id = '00000000-0000-0000-0000-000000000000') -- Super Admin role
      AND is_active = true
    )
  );

-- Admins and super admins can create questions
-- EXACT COPY FROM departments - note the pattern matches exactly
CREATE POLICY "Admins can create role questions"
  ON public.role_questions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_id = auth.uid()
      AND (role_id = '00000000-0000-0000-0000-000000000001' -- Admin role
           OR role_id = '00000000-0000-0000-0000-000000000000') -- Super Admin role
      AND is_active = true
    )
  );

-- Admins and super admins can update questions
-- EXACT COPY FROM departments
CREATE POLICY "Admins can update role questions"
  ON public.role_questions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_id = auth.uid()
      AND (role_id = '00000000-0000-0000-0000-000000000001' -- Admin role
           OR role_id = '00000000-0000-0000-0000-000000000000') -- Super Admin role
      AND is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_id = auth.uid()
      AND (role_id = '00000000-0000-0000-0000-000000000001' -- Admin role
           OR role_id = '00000000-0000-0000-0000-000000000000') -- Super Admin role
      AND is_active = true
    )
  );

-- Admins and super admins can delete questions
-- EXACT COPY FROM departments
CREATE POLICY "Admins can delete role questions"
  ON public.role_questions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_id = auth.uid()
      AND (role_id = '00000000-0000-0000-0000-000000000001' -- Admin role
           OR role_id = '00000000-0000-0000-0000-000000000000') -- Super Admin role
      AND is_active = true
    )
  );

COMMIT;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Test 1: Verify user_profiles policy exists
SELECT 
  'user_profiles' as table_name,
  policyname,
  cmd,
  'Policy exists' as status
FROM pg_policies
WHERE tablename = 'user_profiles'
  AND cmd = 'SELECT';

-- Test 2: Simulate the EXISTS check that role_questions INSERT policy does
-- This should return TRUE
SELECT 
  'Test EXISTS check' as test_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_id = 'ccb4613c-3e6d-4421-8b1c-3277280d658c'
      AND (role_id = '00000000-0000-0000-0000-000000000001'
           OR role_id = '00000000-0000-0000-0000-000000000000')
      AND is_active = true
    ) THEN '✅ EXISTS check PASSES - INSERT should work'
    ELSE '❌ EXISTS check FAILS - This is the problem!'
  END as test_result;

-- Test 3: Verify role_questions policies
SELECT 
  'role_questions' as table_name,
  policyname,
  cmd,
  CASE 
    WHEN cmd = 'INSERT' THEN 'Create'
    WHEN cmd = 'UPDATE' THEN 'Update'
    WHEN cmd = 'SELECT' THEN 'View'
    WHEN cmd = 'DELETE' THEN 'Delete'
    ELSE cmd
  END as operation
FROM pg_policies
WHERE tablename = 'role_questions'
ORDER BY cmd, policyname;

-- Test 4: Check if we can read user_profiles with the same query pattern
SELECT 
  'Test user_profiles read' as test_name,
  COUNT(*) as profile_count,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ Can read profile'
    ELSE '❌ Cannot read profile - RLS is blocking!'
  END as test_result
FROM public.user_profiles
WHERE user_id = 'ccb4613c-3e6d-4421-8b1c-3277280d658c'
  AND (role_id = '00000000-0000-0000-0000-000000000001'
       OR role_id = '00000000-0000-0000-0000-000000000000')
  AND is_active = true;

