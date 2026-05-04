-- Ensure RLS policies for role_questions include super admin
-- This migration drops and recreates policies to ensure super admin access

BEGIN;

-- ============================================
-- DROP ALL EXISTING ROLE_QUESTIONS POLICIES
-- ============================================
DROP POLICY IF EXISTS "Users can view questions for their role" ON role_questions;
DROP POLICY IF EXISTS "Admins can view all role questions" ON role_questions;
DROP POLICY IF EXISTS "Admins can create role questions" ON role_questions;
DROP POLICY IF EXISTS "Admins can update role questions" ON role_questions;
DROP POLICY IF EXISTS "Admins can delete role questions" ON role_questions;

-- ============================================
-- CREATE UPDATED POLICIES WITH SUPER ADMIN
-- ============================================

-- Policy 1: Regular users can view active questions for their role
CREATE POLICY "Users can view questions for their role"
  ON role_questions FOR SELECT
  TO authenticated
  USING (
    is_active = true AND
    role_id IN (
      SELECT role_id FROM user_profiles WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Policy 2: Admins and super admins can view ALL questions (including inactive)
CREATE POLICY "Admins can view all role questions"
  ON role_questions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND (role_id = '00000000-0000-0000-0000-000000000001'::UUID -- Admin role
           OR role_id = '00000000-0000-0000-0000-000000000000'::UUID) -- Super Admin role
      AND is_active = true
    )
  );

-- Policy 3: Admins and super admins can create questions
CREATE POLICY "Admins can create role questions"
  ON role_questions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND (role_id = '00000000-0000-0000-0000-000000000001'::UUID -- Admin role
           OR role_id = '00000000-0000-0000-0000-000000000000'::UUID) -- Super Admin role
      AND is_active = true
    )
  );

-- Policy 4: Admins and super admins can update questions
CREATE POLICY "Admins can update role questions"
  ON role_questions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND (role_id = '00000000-0000-0000-0000-000000000001'::UUID -- Admin role
           OR role_id = '00000000-0000-0000-0000-000000000000'::UUID) -- Super Admin role
      AND is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND (role_id = '00000000-0000-0000-0000-000000000001'::UUID -- Admin role
           OR role_id = '00000000-0000-0000-0000-000000000000'::UUID) -- Super Admin role
      AND is_active = true
    )
  );

-- Policy 5: Admins and super admins can delete questions
CREATE POLICY "Admins can delete role questions"
  ON role_questions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND (role_id = '00000000-0000-0000-0000-000000000001'::UUID -- Admin role
           OR role_id = '00000000-0000-0000-0000-000000000000'::UUID) -- Super Admin role
      AND is_active = true
    )
  );

-- ============================================
-- VERIFICATION
-- ============================================
DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'role_questions';
  
  IF policy_count >= 5 THEN
    RAISE NOTICE '✅ Successfully created % policies for role_questions', policy_count;
  ELSE
    RAISE WARNING '⚠️  Expected 5 policies, found %', policy_count;
  END IF;
END $$;

COMMIT;

