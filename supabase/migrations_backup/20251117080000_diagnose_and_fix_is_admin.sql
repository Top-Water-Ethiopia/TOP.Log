-- Diagnostic and fix for is_admin() function
-- This will help us understand why it's returning false

-- First, create a diagnostic function to see what's happening
CREATE OR REPLACE FUNCTION diagnose_is_admin()
RETURNS TABLE(
  current_user_id UUID,
  user_exists BOOLEAN,
  role_id UUID,
  is_active BOOLEAN,
  is_admin_role BOOLEAN,
  final_result BOOLEAN
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_user_id UUID;
  v_role_id UUID;
  v_is_active BOOLEAN;
  v_user_exists BOOLEAN := false;
BEGIN
  v_user_id := auth.uid();
  
  -- Try to get user profile
  BEGIN
    SELECT role_id, is_active INTO v_role_id, v_is_active
    FROM user_profiles
    WHERE user_id = v_user_id
    LIMIT 1;
    
    v_user_exists := (v_role_id IS NOT NULL);
  EXCEPTION
    WHEN OTHERS THEN
      v_user_exists := false;
  END;
  
  RETURN QUERY SELECT
    v_user_id,
    v_user_exists,
    v_role_id,
    COALESCE(v_is_active, false),
    (v_role_id = '00000000-0000-0000-0000-000000000001'::UUID),
    (v_user_exists AND COALESCE(v_is_active, false) AND v_role_id = '00000000-0000-0000-0000-000000000001'::UUID);
END;
$$;

GRANT EXECUTE ON FUNCTION diagnose_is_admin() TO authenticated;

-- Now let's fix is_admin() one more time with better error handling
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
  v_is_active BOOLEAN;
BEGIN
  -- Get authenticated user ID
  v_user_id := auth.uid();
  
  -- Debug: This will show in logs if enabled
  -- RAISE NOTICE 'is_admin() called for user: %', v_user_id;
  
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Query as postgres (SECURITY DEFINER) - should bypass RLS
  BEGIN
    SELECT role_id, is_active
    INTO v_role_id, v_is_active
    FROM public.user_profiles
    WHERE user_id = v_user_id
    LIMIT 1;
  EXCEPTION
    WHEN OTHERS THEN
      -- If we can't read, return false
      RETURN false;
  END;
  
  -- Check conditions
  IF v_role_id IS NULL THEN
    RETURN false;
  END IF;
  
  IF NOT COALESCE(v_is_active, false) THEN
    RETURN false;
  END IF;
  
  -- Check if admin role
  RETURN (v_role_id = '00000000-0000-0000-0000-000000000001'::UUID);
END;
$$;

ALTER FUNCTION is_admin() OWNER TO postgres;
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION is_admin() TO anon;
GRANT EXECUTE ON FUNCTION is_admin() TO service_role;

-- MOST IMPORTANT: Update departments policies to check role DIRECTLY
-- This avoids the function issue entirely
DROP POLICY IF EXISTS "Admins can view all departments" ON departments;
DROP POLICY IF EXISTS "Admins can create departments" ON departments;
DROP POLICY IF EXISTS "Admins can update departments" ON departments;
DROP POLICY IF EXISTS "Admins can delete departments" ON departments;

-- Use direct role check - this WILL work because users can read their own profile
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






