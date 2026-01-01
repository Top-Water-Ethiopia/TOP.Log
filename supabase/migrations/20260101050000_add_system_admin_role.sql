CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'roles'
      AND column_name = 'level'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'roles'
        AND column_name = 'department_id'
    ) THEN
      INSERT INTO public.roles (id, name, description, level, department_id)
      VALUES (
        '00000000-0000-0000-0000-000000000010',
        'system-admin',
        'System administrator (same privileges as admin)',
        5,
        NULL
      )
      ON CONFLICT (name) DO UPDATE
      SET description = EXCLUDED.description,
          level = EXCLUDED.level,
          department_id = NULL;
    ELSE
      INSERT INTO public.roles (id, name, description, level)
      VALUES (
        '00000000-0000-0000-0000-000000000010',
        'system-admin',
        'System administrator (same privileges as admin)',
        5
      )
      ON CONFLICT (name) DO UPDATE
      SET description = EXCLUDED.description,
          level = EXCLUDED.level;
    END IF;
  ELSE
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'roles'
        AND column_name = 'department_id'
    ) THEN
      INSERT INTO public.roles (id, name, description, department_id)
      VALUES (
        '00000000-0000-0000-0000-000000000010',
        'system-admin',
        'System administrator (same privileges as admin)',
        NULL
      )
      ON CONFLICT (name) DO NOTHING;
    ELSE
      INSERT INTO public.roles (id, name, description)
      VALUES (
        '00000000-0000-0000-0000-000000000010',
        'system-admin',
        'System administrator (same privileges as admin)'
      )
      ON CONFLICT (name) DO NOTHING;
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.permissions') IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.permissions (id, role_id, resource, action)
  SELECT
    uuid_generate_v4(),
    '00000000-0000-0000-0000-000000000010'::UUID,
    resource,
    action
  FROM public.permissions
  WHERE role_id = '00000000-0000-0000-0000-000000000001'::UUID
  ON CONFLICT DO NOTHING;
END $$;

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
      AND (
        up.role_id = '00000000-0000-0000-0000-000000000001'::UUID
        OR up.role_id = '00000000-0000-0000-0000-000000000010'::UUID
        OR up.role_id = '00000000-0000-0000-0000-000000000000'::UUID
      )
      AND up.is_active = true
  ) INTO v_result;

  RETURN COALESCE(v_result, false);
END;
$$;

GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;

CREATE OR REPLACE FUNCTION get_users_with_emails()
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  created_at TIMESTAMPTZ,
  name TEXT,
  department TEXT,
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
  IF NOT EXISTS (
    SELECT 1
    FROM public.user_profiles up_check
    WHERE up_check.user_id = auth.uid()
      AND (
        up_check.role_id = '00000000-0000-0000-0000-000000000001'::UUID
        OR up_check.role_id = '00000000-0000-0000-0000-000000000010'::UUID
        OR up_check.role_id = '00000000-0000-0000-0000-000000000000'::UUID
      )
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
    up.department,
    up.role_id,
    r.name as role_name,
    up.is_active,
    up.created_at as profile_created_at,
    up.last_login
  FROM public.user_profiles up
  JOIN auth.users au ON au.id = up.user_id
  LEFT JOIN public.roles r ON r.id = up.role_id
  ORDER BY up.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_users_with_emails() TO authenticated;
