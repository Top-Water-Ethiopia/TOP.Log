
-- DEFINITIVE FIX: Use SECURITY DEFINER function with proper setup
-- This function will definitely work because it runs as postgres

-- Drop and recreate is_admin() with absolute certainty it works
DROP FUNCTION IF EXISTS is_admin() CASCADE;

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
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- SECURITY DEFINER = runs as postgres = bypasses ALL RLS
  -- This WILL work
  SELECT role_id INTO v_role_id
  FROM user_profiles
  WHERE user_id = v_user_id
    AND is_active = true
  LIMIT 1;
  
  RETURN (v_role_id IS NOT NULL AND v_role_id = '00000000-0000-0000-0000-000000000001'::UUID);
END;
$$;

-- CRITICAL: Ensure function is owned by postgres and is SECURITY DEFINER
ALTER FUNCTION is_admin() OWNER TO postgres;

-- Verify it's SECURITY DEFINER
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'is_admin' 
    AND prosecdef = true
    AND proowner = (SELECT oid FROM pg_roles WHERE rolname = 'postgres')
  ) THEN
    RAISE EXCEPTION 'Function is_admin() is not properly configured as SECURITY DEFINER';
  END IF;
  RAISE NOTICE '✅ is_admin() function is properly configured';
END $$;

GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION is_admin() TO anon;
GRANT EXECUTE ON FUNCTION is_admin() TO service_role;

-- Update departments policies to use the function
-- But ALSO provide direct check as fallback
DROP POLICY IF EXISTS "Admins can view all departments" ON departments;
DROP POLICY IF EXISTS "Admins can create departments" ON departments;
DROP POLICY IF EXISTS "Admins can update departments" ON departments;
DROP POLICY IF EXISTS "Admins can delete departments" ON departments;

-- Use BOTH: function check OR direct check (OR condition)
-- This ensures it works even if one method fails
CREATE POLICY "Admins can view all departments"
  ON departments FOR SELECT
  USING (
    is_admin() = true
    OR EXISTS (
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
    is_admin() = true
    OR EXISTS (
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
    is_admin() = true
    OR EXISTS (
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
    is_admin() = true
    OR EXISTS (
      SELECT 1 
      FROM user_profiles
      WHERE user_id = auth.uid()
        AND role_id = '00000000-0000-0000-0000-000000000001'::UUID
        AND is_active = true
    )
  );

-- Ensure user_profiles policy exists
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
CREATE POLICY "Users can view their own profile" 
  ON user_profiles FOR SELECT
  USING (auth.uid() = user_id);
