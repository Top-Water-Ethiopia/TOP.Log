-- Quick fix: Create is_admin() function and update departments RLS policies
-- Run this if you've already run the departments table migration and are getting RLS errors

-- Create a function to check if current user is admin
-- This uses SECURITY DEFINER to bypass RLS on user_profiles
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
SECURITY DEFINER
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_id = auth.uid()
    AND role_id = '00000000-0000-0000-0000-000000000001' -- Admin role
    AND is_active = true
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can view all departments" ON departments;
DROP POLICY IF EXISTS "Admins can create departments" ON departments;
DROP POLICY IF EXISTS "Admins can update departments" ON departments;
DROP POLICY IF EXISTS "Admins can delete departments" ON departments;

-- Recreate policies using the is_admin() function
CREATE POLICY "Admins can view all departments"
  ON departments FOR SELECT
  USING (is_admin());

CREATE POLICY "Admins can create departments"
  ON departments FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update departments"
  ON departments FOR UPDATE
  USING (is_admin());

CREATE POLICY "Admins can delete departments"
  ON departments FOR DELETE
  USING (is_admin());







