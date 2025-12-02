-- FINAL FIX: Make is_admin() work correctly
-- The issue is that is_admin() returns false even for admin users
-- This fix ensures the function properly bypasses RLS

-- Step 1: Drop and recreate is_admin() with explicit RLS bypass
-- Use DROP CASCADE to remove all dependencies first
DROP FUNCTION IF EXISTS is_admin() CASCADE;

-- Create the function with SECURITY DEFINER
-- This makes it run as the postgres user, bypassing RLS
CREATE FUNCTION is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_user_id UUID;
  v_is_admin BOOLEAN;
BEGIN
  -- Get the current user ID from JWT
  v_user_id := auth.uid();
  
  -- If no user is authenticated, return false
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check admin status
  -- This runs as postgres user (SECURITY DEFINER), so it bypasses RLS
  SELECT EXISTS (
    SELECT 1 
    FROM public.user_profiles
    WHERE user_id = v_user_id
      AND role_id = '00000000-0000-0000-0000-000000000001'::UUID
      AND is_active = true
  ) INTO v_is_admin;
  
  -- Return the result (default to false if NULL)
  RETURN COALESCE(v_is_admin, false);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;

-- Step 2: Ensure user_profiles policy allows reading own profile
-- This is needed for other operations, not for is_admin() (which bypasses RLS)
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
CREATE POLICY "Users can view their own profile" 
  ON user_profiles FOR SELECT
  USING (auth.uid() = user_id);

-- Step 3: Fix departments policies - use ONLY is_admin() function
-- The function bypasses RLS, so it will work even if direct checks fail
DROP POLICY IF EXISTS "Users can view active departments" ON departments;
DROP POLICY IF EXISTS "Admins can view all departments" ON departments;
DROP POLICY IF EXISTS "Admins can create departments" ON departments;
DROP POLICY IF EXISTS "Admins can update departments" ON departments;
DROP POLICY IF EXISTS "Admins can delete departments" ON departments;

-- Regular users can view active departments
CREATE POLICY "Users can view active departments"
  ON departments FOR SELECT
  USING (is_active = true);

-- Admins can view all departments (including inactive)
CREATE POLICY "Admins can view all departments"
  ON departments FOR SELECT
  USING (is_admin());

-- CRITICAL: Admins can create departments
-- This is the key policy that was failing
CREATE POLICY "Admins can create departments"
  ON departments FOR INSERT
  WITH CHECK (is_admin());

-- Admins can update departments
CREATE POLICY "Admins can update departments"
  ON departments FOR UPDATE
  USING (is_admin());

-- Admins can delete departments
CREATE POLICY "Admins can delete departments"
  ON departments FOR DELETE
  USING (is_admin());

-- Step 4: Verify the function works
-- Run this query separately to test: SELECT is_admin();
-- It should return true for admin users

-- Step 5: Add a comment explaining the approach
COMMENT ON FUNCTION is_admin() IS 'Checks if the current user is an admin. Uses SECURITY DEFINER to bypass RLS.';






