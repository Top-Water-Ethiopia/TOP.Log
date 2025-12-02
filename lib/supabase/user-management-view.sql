-- Create a view for admins to see user information including emails
-- This allows admins to query user data without needing Admin API access

-- Create a function that returns user data with emails (admin only)
CREATE OR REPLACE FUNCTION get_users_with_emails()
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  created_at TIMESTAMPTZ,
  name TEXT,
  department_name TEXT,
  role_id UUID,
  role_name TEXT,
  is_active BOOLEAN,
  profile_created_at TIMESTAMPTZ,
  last_login TIMESTAMPTZ
)
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if current user is admin
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles up_check
    WHERE up_check.user_id = auth.uid()
    AND up_check.role_id = '00000000-0000-0000-0000-000000000001'::UUID
    AND up_check.is_active = true
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin privileges required.';
  END IF;

  RETURN QUERY
  SELECT 
    up.user_id,
    au.email,
    au.created_at,
    up.name,
    d.name as department_name,
    up.role_id,
    r.name as role_name,
    up.is_active,
    up.created_at as profile_created_at,
    up.last_login
  FROM public.user_profiles up
  JOIN auth.users au ON au.id = up.user_id
  LEFT JOIN public.roles r ON r.id = up.role_id
  LEFT JOIN public.departments d ON d.id = up.department_id
  ORDER BY up.created_at DESC;
END;
$$;

-- Grant execute permission to authenticated users (RLS will handle admin check)
GRANT EXECUTE ON FUNCTION get_users_with_emails() TO authenticated;

-- Note: This function uses SECURITY DEFINER to access auth.users table
-- Only admins can execute it (checked in the function body)



