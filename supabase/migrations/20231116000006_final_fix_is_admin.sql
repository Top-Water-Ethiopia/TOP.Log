-- Final fix for is_admin() function
-- This version ensures the function can read user_profiles by using proper grants

-- First, ensure postgres role can read user_profiles (it should by default, but let's be explicit)
-- Note: postgres role already has full access, but let's make sure

-- Update the function to be more explicit
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public, pg_catalog
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  user_role_id UUID;
  admin_role_id UUID := '00000000-0000-0000-0000-000000000001'::UUID;
  current_user_id UUID;
BEGIN
  -- Get the current authenticated user ID
  current_user_id := auth.uid();
  
  -- If no user is authenticated, return false
  IF current_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- SECURITY DEFINER means this runs as the function owner (postgres)
  -- postgres role should bypass RLS, but let's be explicit
  -- Query user_profiles directly - this should work because we're postgres
  PERFORM 1
  FROM public.user_profiles
  WHERE user_id = current_user_id
    AND role_id = admin_role_id
    AND is_active = true
  LIMIT 1;
  
  -- If the query found a row, FOUND will be true
  RETURN FOUND;
END;
$$;

-- Ensure function is owned by postgres (should already be)
ALTER FUNCTION is_admin() OWNER TO postgres;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION is_admin() TO anon;

-- Now update the RLS policies to use the function
DROP POLICY IF EXISTS "Admins can view all departments" ON departments;
DROP POLICY IF EXISTS "Admins can create departments" ON departments;
DROP POLICY IF EXISTS "Admins can update departments" ON departments;
DROP POLICY IF EXISTS "Admins can delete departments" ON departments;

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







