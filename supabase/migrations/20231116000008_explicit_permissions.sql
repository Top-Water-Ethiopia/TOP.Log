-- Fix is_admin() with explicit permissions
-- This ensures postgres role can read user_profiles even with RLS

-- First, ensure postgres has explicit SELECT on user_profiles
-- (It should already, but let's be explicit)
GRANT SELECT ON public.user_profiles TO postgres;

-- Now recreate the function with explicit permissions
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
  role_check UUID;
BEGIN
  -- Get current authenticated user
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Query as postgres role (SECURITY DEFINER) - should bypass RLS
  -- Use a simple SELECT INTO
  SELECT role_id INTO role_check
  FROM public.user_profiles
  WHERE user_id = current_user_id
    AND is_active = true
  LIMIT 1;
  
  -- Check if role matches admin
  RETURN (role_check IS NOT NULL AND role_check = admin_role_id);
END;
$$;

-- Ensure ownership and security
ALTER FUNCTION is_admin() OWNER TO postgres;
ALTER FUNCTION is_admin() SECURITY DEFINER;

-- Grant execute
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION is_admin() TO anon;
GRANT EXECUTE ON FUNCTION is_admin() TO service_role;

-- Alternative: If the above still doesn't work, let's try checking directly in the policy
-- But first, let's verify user_profiles RLS allows reading own profile
-- This should already exist, but let's make sure:

-- Check if policy exists for users to read their own profile
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'user_profiles'
    AND policyname = 'Users can view their own profile'
  ) THEN
    CREATE POLICY "Users can view their own profile" 
      ON user_profiles FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- The key insight: When is_admin() runs as SECURITY DEFINER (postgres),
-- it should bypass ALL RLS policies. If it's not working, there might be
-- an issue with how Supabase handles SECURITY DEFINER functions.

-- Let's also create a version that uses a materialized approach
-- by checking if we can at least read the user's own profile
CREATE OR REPLACE FUNCTION is_admin_v2()
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  admin_role_id UUID := '00000000-0000-0000-0000-000000000001'::UUID;
  current_user_id UUID;
  user_role UUID;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Try to get role_id - this should work as postgres
  BEGIN
    SELECT role_id INTO user_role
    FROM user_profiles
    WHERE user_id = current_user_id
      AND is_active = true;
    
    RETURN (user_role = admin_role_id);
  EXCEPTION
    WHEN OTHERS THEN
      -- If we can't read, return false
      RETURN false;
  END;
END;
$$;

ALTER FUNCTION is_admin_v2() OWNER TO postgres;
GRANT EXECUTE ON FUNCTION is_admin_v2() TO authenticated;

-- Update policies to try is_admin_v2 if is_admin doesn't work
-- (We'll test both)







