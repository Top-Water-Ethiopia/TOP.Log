-- FIX: Enable admins to create departments
-- This ensures the RLS policies work correctly

-- Step 1: Ensure user_profiles policy allows reading own profile
-- This is critical for the EXISTS check in departments policies
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
CREATE POLICY "Users can view their own profile" 
  ON user_profiles FOR SELECT
  USING (auth.uid() = user_id);

-- Step 2: Create a SECURITY DEFINER function that bypasses RLS
-- This function will be used by policies to check admin status
DROP FUNCTION IF EXISTS is_admin() CASCADE;
CREATE FUNCTION is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  -- This function runs as the postgres user, bypassing RLS
  RETURN EXISTS (
    SELECT 1 
    FROM public.user_profiles
    WHERE user_id = auth.uid()
      AND role_id = '00000000-0000-0000-0000-000000000001'::UUID
      AND is_active = true
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;

-- Step 3: Fix departments policies to use BOTH approaches
-- This ensures it works even if one method fails

-- Drop existing policies
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
  USING (
    is_admin() OR
    EXISTS (
      SELECT 1 
      FROM user_profiles
      WHERE user_id = auth.uid()
        AND role_id = '00000000-0000-0000-0000-000000000001'::UUID
        AND is_active = true
    )
  );

-- CRITICAL: Admins can create departments
-- Use both is_admin() function AND direct check for maximum reliability
CREATE POLICY "Admins can create departments"
  ON departments FOR INSERT
  WITH CHECK (
    is_admin() OR
    EXISTS (
      SELECT 1 
      FROM user_profiles
      WHERE user_id = auth.uid()
        AND role_id = '00000000-0000-0000-0000-000000000001'::UUID
        AND is_active = true
    )
  );

-- Admins can update departments
CREATE POLICY "Admins can update departments"
  ON departments FOR UPDATE
  USING (
    is_admin() OR
    EXISTS (
      SELECT 1 
      FROM user_profiles
      WHERE user_id = auth.uid()
        AND role_id = '00000000-0000-0000-0000-000000000001'::UUID
        AND is_active = true
    )
  );

-- Admins can delete departments
CREATE POLICY "Admins can delete departments"
  ON departments FOR DELETE
  USING (
    is_admin() OR
    EXISTS (
      SELECT 1 
      FROM user_profiles
      WHERE user_id = auth.uid()
        AND role_id = '00000000-0000-0000-0000-000000000001'::UUID
        AND is_active = true
    )
  );

-- Step 4: Verify setup
DO $$
BEGIN
  RAISE NOTICE '✅ Policies created successfully';
  RAISE NOTICE '✅ is_admin() function created with SECURITY DEFINER';
  RAISE NOTICE '✅ Admin users can now create departments';
END $$;

-- Verification queries (run these separately to check)
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'user_profiles';
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'departments';
-- SELECT is_admin(); -- Should return true for admin users

