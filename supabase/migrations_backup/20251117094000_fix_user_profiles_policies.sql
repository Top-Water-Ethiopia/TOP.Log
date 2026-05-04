
-- Verify and fix user_profiles RLS policies
-- This ensures admins can manage users

-- Step 1: Check current policies
SELECT 'Current user_profiles policies:' as info;
SELECT policyname, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'user_profiles'
ORDER BY policyname;

-- Step 2: Ensure basic policy exists
-- Users should be able to read their own profile
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
CREATE POLICY "Users can view their own profile" 
  ON user_profiles FOR SELECT
  USING (auth.uid() = user_id);

-- Step 3: Create is_admin() function if it doesn't exist
-- This function bypasses RLS, so it can check admin status reliably
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_user_id UUID;
  v_result BOOLEAN;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;
  SELECT EXISTS (
    SELECT 1 
    FROM public.user_profiles up
    WHERE up.user_id = v_user_id
      AND up.role_id = '00000000-0000-0000-0000-000000000001'::UUID
      AND up.is_active = true
  ) INTO v_result;
  RETURN COALESCE(v_result, false);
END;
$$;

GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;

-- Step 4: Admins should be able to read all profiles
-- This is needed for user management
-- Use is_admin() function to avoid circular dependency
DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;
CREATE POLICY "Admins can view all profiles"
  ON user_profiles FOR SELECT
  USING (is_admin());

-- Step 5: Admins should be able to insert profiles (for creating users)
DROP POLICY IF EXISTS "Admins can create profiles" ON user_profiles;
CREATE POLICY "Admins can create profiles"
  ON user_profiles FOR INSERT
  WITH CHECK (is_admin());

-- Step 6: Admins should be able to update profiles
DROP POLICY IF EXISTS "Admins can update profiles" ON user_profiles;
CREATE POLICY "Admins can update profiles"
  ON user_profiles FOR UPDATE
  USING (is_admin());

-- Step 7: Verify policies
SELECT 'Updated user_profiles policies:' as info;
SELECT policyname, cmd FROM pg_policies 
WHERE tablename = 'user_profiles' 
ORDER BY policyname;
  