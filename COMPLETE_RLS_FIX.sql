-- COMPLETE RLS FIX: Fix both user_profiles and role_questions RLS policies
-- This ensures both tables work correctly from the client
-- Run this in Supabase SQL Editor

BEGIN;

-- ============================================================================
-- PART 1: Fix user_profiles RLS (CRITICAL - must be fixed first)
-- ============================================================================

-- Drop ALL existing SELECT policies on user_profiles to avoid conflicts
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
    RAISE NOTICE 'Dropped user_profiles SELECT policy: %', policy_record.policyname;
  END LOOP;
END $$;

-- Create a clean policy that allows authenticated users to read their own profile
-- This MUST work for the role_questions INSERT policy check to succeed
CREATE POLICY "Users can view their own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- PART 2: Fix role_questions RLS policies
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view questions for their role" ON role_questions;
DROP POLICY IF EXISTS "Admins can view all role questions" ON role_questions;
DROP POLICY IF EXISTS "Admins can create role questions" ON role_questions;
DROP POLICY IF EXISTS "Admins can update role questions" ON role_questions;
DROP POLICY IF EXISTS "Admins can delete role questions" ON role_questions;

-- Regular users can view active questions for their role
CREATE POLICY "Users can view questions for their role"
  ON role_questions FOR SELECT
  TO authenticated
  USING (
    is_active = true AND
    role_id IN (
      SELECT role_id FROM user_profiles WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Admins and super admins can view ALL questions
CREATE POLICY "Admins can view all role questions"
  ON role_questions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND (role_id = '00000000-0000-0000-0000-000000000001'::UUID -- Admin
           OR role_id = '00000000-0000-0000-0000-000000000000'::UUID) -- Super Admin
      AND is_active = true
    )
  );

-- Admins and super admins can create questions
-- This is the one that was failing!
CREATE POLICY "Admins can create role questions"
  ON role_questions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND (role_id = '00000000-0000-0000-0000-000000000001'::UUID -- Admin
           OR role_id = '00000000-0000-0000-0000-000000000000'::UUID) -- Super Admin
      AND is_active = true
    )
  );

-- Admins and super admins can update questions
CREATE POLICY "Admins can update role questions"
  ON role_questions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND (role_id = '00000000-0000-0000-0000-000000000001'::UUID -- Admin
           OR role_id = '00000000-0000-0000-0000-000000000000'::UUID) -- Super Admin
      AND is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND (role_id = '00000000-0000-0000-0000-000000000001'::UUID -- Admin
           OR role_id = '00000000-0000-0000-0000-000000000000'::UUID) -- Super Admin
      AND is_active = true
    )
  );

-- Admins and super admins can delete questions
CREATE POLICY "Admins can delete role questions"
  ON role_questions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND (role_id = '00000000-0000-0000-0000-000000000001'::UUID -- Admin
           OR role_id = '00000000-0000-0000-0000-000000000000'::UUID) -- Super Admin
      AND is_active = true
    )
  );

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify user_profiles SELECT policy exists
SELECT 
  'user_profiles' as table_name,
  policyname,
  cmd,
  '✅ Policy exists' as status
FROM pg_policies
WHERE tablename = 'user_profiles'
  AND cmd = 'SELECT'
  AND policyname = 'Users can view their own profile';

-- Verify all role_questions policies exist
SELECT 
  'role_questions' as table_name,
  policyname,
  cmd,
  CASE 
    WHEN cmd = 'SELECT' THEN 'View'
    WHEN cmd = 'INSERT' THEN 'Create'
    WHEN cmd = 'UPDATE' THEN 'Update'
    WHEN cmd = 'DELETE' THEN 'Delete'
    ELSE cmd
  END as operation
FROM pg_policies
WHERE tablename = 'role_questions'
ORDER BY cmd, policyname;

-- Test: Verify the INSERT check logic would work for your user
-- Replace 'ccb4613c-3e6d-4421-8b1c-3277280d658c' with your user_id if different
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = 'ccb4613c-3e6d-4421-8b1c-3277280d658c'
      AND (role_id = '00000000-0000-0000-0000-000000000001'::UUID
           OR role_id = '00000000-0000-0000-0000-000000000000'::UUID)
      AND is_active = true
    ) THEN '✅ INSERT check logic would PASS for your user'
    ELSE '❌ INSERT check logic would FAIL for your user'
  END as final_test_result;

