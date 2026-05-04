-- Fix is_admin() function to properly bypass RLS
-- This version explicitly bypasses RLS by using SECURITY DEFINER and proper permissions

-- Use CREATE OR REPLACE to update the function without dropping dependent policies
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
BEGIN
  -- SECURITY DEFINER runs with the privileges of the function owner (postgres)
  -- This allows us to bypass RLS on user_profiles
  SELECT role_id INTO user_role_id
  FROM public.user_profiles
  WHERE user_id = auth.uid()
    AND is_active = true
  LIMIT 1;
  
  -- Return true if role matches admin role ID
  RETURN (user_role_id IS NOT NULL AND user_role_id = admin_role_id);
END;
$$;

-- Ensure the function owner has proper permissions
ALTER FUNCTION is_admin() OWNER TO postgres;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION is_admin() TO anon;

-- Add comment
COMMENT ON FUNCTION is_admin() IS 'Checks if the current authenticated user has admin role. Uses SECURITY DEFINER to bypass RLS on user_profiles.';

