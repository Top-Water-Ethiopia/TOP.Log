
-- COMPREHENSIVE FIX FOR DEPARTMENTS RLS
-- This ensures everything works correctly

-- Step 1: Ensure user_profiles allows reading own profile
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
CREATE POLICY "Users can view their own profile" 
  ON user_profiles FOR SELECT
  USING (auth.uid() = user_id);

-- Step 2: Create a SECURITY DEFINER function that actually works
-- Using a different approach - create a helper view first
CREATE OR REPLACE VIEW current_user_role AS
SELECT 
  user_id,
  role_id,
  is_active
FROM user_profiles
WHERE user_id = auth.uid();

-- Grant access to the view
GRANT SELECT ON current_user_role TO authenticated;

-- Now create is_admin() using the view (which should work better)
DROP FUNCTION IF EXISTS is_admin() CASCADE;

CREATE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM current_user_role
    WHERE role_id = '00000000-0000-0000-0000-000000000001'::UUID
      AND is_active = true
  );
$$;

ALTER FUNCTION is_admin() OWNER TO postgres;
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION is_admin() TO anon;

-- Step 3: Update departments policies to use direct check
-- This is the most reliable approach
DROP POLICY IF EXISTS "Admins can view all departments" ON departments;
DROP POLICY IF EXISTS "Admins can create departments" ON departments;
DROP POLICY IF EXISTS "Admins can update departments" ON departments;
DROP POLICY IF EXISTS "Admins can delete departments" ON departments;

-- Use direct EXISTS check - this should work because users can read own profile
CREATE POLICY "Admins can view all departments"
  ON departments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 
      FROM user_profiles
      WHERE user_id = auth.uid()
        AND role_id = '00000000-0000-0000-0000-000000000001'::UUID
        AND is_active = true
    )
  );

CREATE POLICY "Admins can create departments"
  ON departments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM user_profiles
      WHERE user_id = auth.uid()
        AND role_id = '00000000-0000-0000-0000-000000000001'::UUID
        AND is_active = true
    )
  );

CREATE POLICY "Admins can update departments"
  ON departments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 
      FROM user_profiles
      WHERE user_id = auth.uid()
        AND role_id = '00000000-0000-0000-0000-000000000001'::UUID
        AND is_active = true
    )
  );

CREATE POLICY "Admins can delete departments"
  ON departments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 
      FROM user_profiles
      WHERE user_id = auth.uid()
        AND role_id = '00000000-0000-0000-0000-000000000001'::UUID
        AND is_active = true
    )
  );
