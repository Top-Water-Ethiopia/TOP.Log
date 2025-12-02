-- WORKING FIX: is_admin() function that actually bypasses RLS
-- The key is to use SECURITY DEFINER with proper configuration

-- Completely drop and recreate the function
DROP FUNCTION IF EXISTS is_admin() CASCADE;

-- Create the function with SECURITY DEFINER
-- This makes it run as the function owner (postgres), which bypasses RLS
CREATE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_user_id UUID;
  v_role_id UUID;
  v_is_active BOOLEAN;
BEGIN
  -- Get the current authenticated user ID
  v_user_id := auth.uid();
  
  -- If no user is authenticated, return false
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- SECURITY DEFINER means this runs as postgres role
  -- postgres role has full access and bypasses RLS
  -- Query user_profiles directly - this WILL work because we're postgres
  SELECT 
    role_id,
    is_active
  INTO 
    v_role_id,
    v_is_active
  FROM public.user_profiles
  WHERE user_id = v_user_id
  LIMIT 1;
  
  -- Check if user exists, is active, and has admin role
  IF v_role_id IS NULL THEN
    RETURN false;
  END IF;
  
  IF NOT v_is_active THEN
    RETURN false;
  END IF;
  
  -- Check if role is admin
  RETURN (v_role_id = '00000000-0000-0000-0000-000000000001'::UUID);
END;
$$;

-- CRITICAL: Set the function owner to postgres explicitly
ALTER FUNCTION is_admin() OWNER TO postgres;

-- CRITICAL: Ensure SECURITY DEFINER is set (should be from CREATE, but let's be explicit)
-- Note: ALTER FUNCTION doesn't support SECURITY DEFINER directly, it's set in CREATE

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION is_admin() TO anon;
GRANT EXECUTE ON FUNCTION is_admin() TO service_role;

-- Verify function attributes
DO $$
DECLARE
  func_owner TEXT;
  func_security TEXT;
BEGIN
  SELECT 
    pg_get_userbyid(proowner)::TEXT,
    CASE WHEN prosecdef THEN 'DEFINER' ELSE 'INVOKER' END
  INTO func_owner, func_security
  FROM pg_proc
  WHERE proname = 'is_admin'
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
  
  RAISE NOTICE 'Function owner: %', func_owner;
  RAISE NOTICE 'Security: %', func_security;
  
  IF func_owner != 'postgres' THEN
    RAISE WARNING 'Function owner is not postgres!';
  END IF;
  
  IF func_security != 'DEFINER' THEN
    RAISE WARNING 'Function is not SECURITY DEFINER!';
  END IF;
END $$;

-- Test the function (this will show if it works)
-- Note: This test runs as the current user in SQL editor, so it might return false
-- But when called from your app as an authenticated admin user, it should return true
DO $$
DECLARE
  test_result BOOLEAN;
BEGIN
  SELECT is_admin() INTO test_result;
  RAISE NOTICE 'is_admin() test result: %', test_result;
  RAISE NOTICE 'Note: If you see false here, it might be because you are not authenticated as a user in SQL editor';
  RAISE NOTICE 'The function should work correctly when called from your app with an authenticated admin user';
END $$;






