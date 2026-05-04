-- Copy exact RLS pattern from departments to role_questions
-- This uses the same pattern that works for departments INSERT/UPDATE
-- Run this in Supabase SQL Editor

BEGIN;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view questions for their role" ON role_questions;
DROP POLICY IF EXISTS "Admins can view all role questions" ON role_questions;
DROP POLICY IF EXISTS "Admins can create role questions" ON role_questions;
DROP POLICY IF EXISTS "Admins can update role questions" ON role_questions;
DROP POLICY IF EXISTS "Admins can delete role questions" ON role_questions;

-- Users can view active questions for their role
CREATE POLICY "Users can view questions for their role"
  ON role_questions FOR SELECT
  TO authenticated
  USING (
    is_active = true AND
    role_id IN (
      SELECT role_id FROM user_profiles WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Admins and super admins can view all questions (including inactive)
-- EXACT COPY FROM departments "Admins can view all departments"
CREATE POLICY "Admins can view all role questions"
  ON role_questions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND (role_id = '00000000-0000-0000-0000-000000000001' -- Admin role
           OR role_id = '00000000-0000-0000-0000-000000000000') -- Super Admin role
      AND is_active = true
    )
  );

-- Admins and super admins can create questions
-- EXACT COPY FROM departments "Admins can create departments"
CREATE POLICY "Admins can create role questions"
  ON role_questions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND (role_id = '00000000-0000-0000-0000-000000000001' -- Admin role
           OR role_id = '00000000-0000-0000-0000-000000000000') -- Super Admin role
      AND is_active = true
    )
  );

-- Admins and super admins can update questions
-- EXACT COPY FROM departments "Admins can update departments"
CREATE POLICY "Admins can update role questions"
  ON role_questions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND (role_id = '00000000-0000-0000-0000-000000000001' -- Admin role
           OR role_id = '00000000-0000-0000-0000-000000000000') -- Super Admin role
      AND is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND (role_id = '00000000-0000-0000-0000-000000000001' -- Admin role
           OR role_id = '00000000-0000-0000-0000-000000000000') -- Super Admin role
      AND is_active = true
    )
  );

-- Admins and super admins can delete questions
-- EXACT COPY FROM departments "Admins can delete departments"
CREATE POLICY "Admins can delete role questions"
  ON role_questions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND (role_id = '00000000-0000-0000-0000-000000000001' -- Admin role
           OR role_id = '00000000-0000-0000-0000-000000000000') -- Super Admin role
      AND is_active = true
    )
  );

COMMIT;

-- Verification
SELECT 
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

-- Test the INSERT check (same as departments uses)
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = 'ccb4613c-3e6d-4421-8b1c-3277280d658c'
      AND (role_id = '00000000-0000-0000-0000-000000000001' -- Admin role
           OR role_id = '00000000-0000-0000-0000-000000000000') -- Super Admin role
      AND is_active = true
    ) THEN '✅ INSERT check would PASS (same as departments)'
    ELSE '❌ INSERT check would FAIL'
  END as test_result;

