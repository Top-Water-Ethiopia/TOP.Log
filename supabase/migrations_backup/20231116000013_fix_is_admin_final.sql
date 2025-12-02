-- Final fix for is_admin() - using DROP CASCADE and fresh CREATE
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
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  SELECT 
    role_id,
    is_active
  INTO 
    v_role_id,
    v_is_active
  FROM public.user_profiles
  WHERE user_id = v_user_id
  LIMIT 1;
  
  IF v_role_id IS NULL OR NOT v_is_active THEN
    RETURN false;
  END IF;
  
  RETURN (v_role_id = '00000000-0000-0000-0000-000000000001'::UUID);
END;
$$;

ALTER FUNCTION is_admin() OWNER TO postgres;
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION is_admin() TO anon;
GRANT EXECUTE ON FUNCTION is_admin() TO service_role;






