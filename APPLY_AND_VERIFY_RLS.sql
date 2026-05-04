-- Apply RLS Policies and Verify They Work
-- Run this in Supabase SQL Editor

BEGIN;

-- Step 1: Ensure user_profiles allows reading own profile
-- This is CRITICAL - the role_questions policy checks user_profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;

CREATE POLICY "Users can view their own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Step 2: Apply role_questions RLS policies

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view questions for their role" ON role_questions;
DROP POLICY IF EXISTS "Admins can view all role questions" ON role_questions;
DROP POLICY IF EXISTS "Admins can create role questions" ON role_questions;
DROP POLICY IF EXISTS "Admins can update role questions" ON role_questions;
DROP POLICY IF EXISTS "Admins can delete role questions" ON role_questions;

-- Create policies that include super admin (00000000-0000-0000-0000-000000000000)

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

-- Verification queries

-- Verify role_questions policies
SELECT 
  policyname, 
  cmd,
  CASE 
    WHEN cmd = 'SELECT' THEN 'View'
    WHEN cmd = 'INSERT' THEN 'Create'
    WHEN cmd = 'UPDATE' THEN 'Update'
    WHEN cmd = 'DELETE' THEN 'Delete'
    ELSE cmd
  END as operation,
  CASE 
    WHEN policyname LIKE '%Admin%' THEN '✅ Admin/Super Admin'
    WHEN policyname LIKE '%Users can view%' THEN '✅ Regular Users'
    ELSE 'Other'
  END as applies_to
FROM pg_policies 
WHERE tablename = 'role_questions' 
ORDER BY cmd, policyname;

-- Verify user_profiles SELECT policy exists
SELECT 
  policyname,
  cmd,
  CASE 
    WHEN policyname = 'Users can view their own profile' THEN '✅ Exists'
    ELSE 'Other'
  END as status
FROM pg_policies
WHERE tablename = 'user_profiles'
  AND cmd = 'SELECT';

-- Test the check for your user
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = 'ccb4613c-3e6d-4421-8b1c-3277280d658c'
      AND (role_id = '00000000-0000-0000-0000-000000000001'::UUID
           OR role_id = '00000000-0000-0000-0000-000000000000'::UUID)
      AND is_active = true
    ) THEN '✅ INSERT check would PASS for your user'
    ELSE '❌ INSERT check would FAIL for your user'
  END as test_result;

