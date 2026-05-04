-- Fix RLS policies and add debugging
-- This version adds better error handling and ensures is_admin() works correctly

-- First, let's verify and fix the is_admin() function one more time
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  user_role_id UUID;
  admin_role_id UUID := '00000000-0000-0000-0000-000000000001'::UUID;
  current_user_id UUID;
BEGIN
  -- Get the current user ID
  current_user_id := auth.uid();
  
  -- If no user is authenticated, return false
  IF current_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Get the role_id directly, bypassing RLS by using SECURITY DEFINER
  -- The function owner (postgres) has full access, so this bypasses RLS
  SELECT role_id INTO user_role_id
  FROM public.user_profiles
  WHERE user_id = current_user_id
    AND is_active = true
  LIMIT 1;
  
  -- Return true if role matches admin role ID
  RETURN (user_role_id IS NOT NULL AND user_role_id = admin_role_id);
END;
$$;

-- Ensure proper ownership and permissions
ALTER FUNCTION is_admin() OWNER TO postgres;
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION is_admin() TO anon;

-- Drop and recreate policies to ensure they're using the updated function
DROP POLICY IF EXISTS "Admins can view all departments" ON departments;
DROP POLICY IF EXISTS "Admins can create departments" ON departments;
DROP POLICY IF EXISTS "Admins can update departments" ON departments;
DROP POLICY IF EXISTS "Admins can delete departments" ON departments;

-- Recreate policies
CREATE POLICY "Admins can view all departments"
  ON departments FOR SELECT
  USING (is_admin() = true);

CREATE POLICY "Admins can create departments"
  ON departments FOR INSERT
  WITH CHECK (is_admin() = true);

CREATE POLICY "Admins can update departments"
  ON departments FOR UPDATE
  USING (is_admin() = true);

CREATE POLICY "Admins can delete departments"
  ON departments FOR DELETE
  USING (is_admin() = true);

-- Add a helper function to check current user's role (for debugging)
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS TABLE(user_id UUID, role_id UUID, is_active BOOLEAN, name TEXT)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    up.user_id,
    up.role_id,
    up.is_active,
    up.name
  FROM public.user_profiles up
  WHERE up.user_id = auth.uid()
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION get_current_user_role() TO authenticated;

COMMENT ON FUNCTION get_current_user_role() IS 'Helper function to debug current user role. Returns user_id, role_id, is_active, and name.';







