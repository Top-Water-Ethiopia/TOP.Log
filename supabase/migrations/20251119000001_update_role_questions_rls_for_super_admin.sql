-- Update RLS policies for role_questions to include super admin
-- This allows super admins to view, create, update, and delete role questions

BEGIN;

-- Drop existing admin policies
DROP POLICY IF EXISTS "Admins can view all role questions" ON role_questions;
DROP POLICY IF EXISTS "Admins can create role questions" ON role_questions;
DROP POLICY IF EXISTS "Admins can update role questions" ON role_questions;
DROP POLICY IF EXISTS "Admins can delete role questions" ON role_questions;

-- Create updated policies that include both admin and super admin
CREATE POLICY "Admins can view all role questions"
  ON role_questions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND (role_id = '00000000-0000-0000-0000-000000000001' -- Admin role
           OR role_id = '00000000-0000-0000-0000-000000000000') -- Super Admin role
    )
  );

CREATE POLICY "Admins can create role questions"
  ON role_questions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND (role_id = '00000000-0000-0000-0000-000000000001' -- Admin role
           OR role_id = '00000000-0000-0000-0000-000000000000') -- Super Admin role
    )
  );

CREATE POLICY "Admins can update role questions"
  ON role_questions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND (role_id = '00000000-0000-0000-0000-000000000001' -- Admin role
           OR role_id = '00000000-0000-0000-0000-000000000000') -- Super Admin role
    )
  );

CREATE POLICY "Admins can delete role questions"
  ON role_questions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND (role_id = '00000000-0000-0000-0000-000000000001' -- Admin role
           OR role_id = '00000000-0000-0000-0000-000000000000') -- Super Admin role
    )
  );

COMMIT;





