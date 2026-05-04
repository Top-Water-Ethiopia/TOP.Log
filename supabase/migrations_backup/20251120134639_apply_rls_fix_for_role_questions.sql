-- QUICK FIX: Apply RLS policies for role_questions to allow super admin access
-- This migration updates RLS policies to include super admin role support

BEGIN;

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

-- Verify policies were created (this will show in the migration output)
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

