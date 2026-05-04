-- Fix is_admin() function to work correctly
-- This version ensures the function properly checks user_profiles with SECURITY DEFINER

-- Drop and recreate the function
DROP FUNCTION IF EXISTS is_admin();

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
  user_role_id UUID;
BEGIN
  -- Get the current authenticated user ID
  current_user_id := auth.uid();
  
  -- If no user is authenticated, return false
  IF current_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check if user has admin role
  -- Using SECURITY DEFINER, we can bypass RLS on user_profiles
  SELECT role_id INTO user_role_id
  FROM user_profiles
  WHERE user_id = current_user_id
    AND is_active = true
  LIMIT 1;
  
  -- Return true if role_id matches admin role ID
  RETURN (user_role_id IS NOT NULL AND user_role_id = admin_role_id);
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but return false to be safe
    RAISE WARNING 'is_admin() error: %', SQLERRM;
    RETURN false;
END;
$$;

-- Set function owner and permissions
ALTER FUNCTION is_admin() OWNER TO postgres;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION is_admin() TO anon;

-- Add comment
COMMENT ON FUNCTION is_admin() IS 'Checks if the current authenticated user has admin role. Uses SECURITY DEFINER to bypass RLS on user_profiles. Returns false if user is not authenticated, profile does not exist, profile is inactive, or role_id does not match admin role ID.';







