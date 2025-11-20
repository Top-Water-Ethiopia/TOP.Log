-- Update RLS policies for departments table to include super admin
-- This ensures super admins can view, create, update, and delete departments

BEGIN;

-- Drop existing admin policies
DROP POLICY IF EXISTS "Admins can view all departments" ON departments;
DROP POLICY IF EXISTS "Admins can create departments" ON departments;
DROP POLICY IF EXISTS "Admins can update departments" ON departments;
DROP POLICY IF EXISTS "Admins can delete departments" ON departments;

-- Keep the policy for regular users to view active departments
-- (This should already exist, but we'll ensure it's there)
DROP POLICY IF EXISTS "Users can view active departments" ON departments;
CREATE POLICY "Users can view active departments"
  ON departments FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Admins and super admins can view all departments (including inactive)
CREATE POLICY "Admins can view all departments"
  ON departments FOR SELECT
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

-- Admins and super admins can create departments
CREATE POLICY "Admins can create departments"
  ON departments FOR INSERT
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

-- Admins and super admins can update departments
CREATE POLICY "Admins can update departments"
  ON departments FOR UPDATE
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

-- Admins and super admins can delete departments
CREATE POLICY "Admins can delete departments"
  ON departments FOR DELETE
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

