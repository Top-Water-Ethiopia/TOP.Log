-- Force bypass RLS in is_admin() function
-- This version uses explicit table access that bypasses RLS

-- Drop and recreate with explicit RLS bypass
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  admin_role_id UUID := '00000000-0000-0000-0000-000000000001'::UUID;
  current_user_id UUID;
  result BOOLEAN := false;
BEGIN
  -- Get current user ID
  current_user_id := auth.uid();
  
  -- Return false if not authenticated
  IF current_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- SECURITY DEFINER runs as postgres role, which should bypass RLS
  -- But to be absolutely sure, we'll use a direct query with explicit schema
  -- and ensure we're accessing the table as the function owner
  SELECT EXISTS (
    SELECT 1 
    FROM public.user_profiles
    WHERE user_id = current_user_id
      AND role_id = admin_role_id
      AND is_active = true
  ) INTO result;
  
  RETURN result;
END;
$$;

-- Critical: Set the function to run with definer privileges and ensure owner
ALTER FUNCTION is_admin() OWNER TO postgres;
ALTER FUNCTION is_admin() SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION is_admin() TO anon;
GRANT EXECUTE ON FUNCTION is_admin() TO service_role;

-- Verify the function definition
COMMENT ON FUNCTION is_admin() IS 'Checks if current user is admin. Uses SECURITY DEFINER to bypass RLS on user_profiles.';

-- Test: Let's also create a simpler version that we can test
CREATE OR REPLACE FUNCTION test_user_role()
RETURNS TABLE(user_id UUID, role_id UUID, is_active BOOLEAN)
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
    up.is_active
  FROM public.user_profiles up
  WHERE up.user_id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION test_user_role() TO authenticated;

-- This test function will help us debug what's happening







