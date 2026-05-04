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
        uuid_generate_v4(),
        'system-admin',
        'System administrator (same privileges as admin)',
        5,
        NULL
      )
      ON CONFLICT (name) WHERE department_id IS NULL DO UPDATE
      SET description = EXCLUDED.description,
          level = EXCLUDED.level,
          department_id = NULL;
    ELSE
      INSERT INTO public.roles (id, name, description, level)
      VALUES (
        uuid_generate_v4(),
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
        uuid_generate_v4(),
        'system-admin',
        'System administrator (same privileges as admin)',
        NULL
      )
      ON CONFLICT (name) WHERE department_id IS NULL DO UPDATE
      SET description = EXCLUDED.description,
          department_id = NULL;
    ELSE
      INSERT INTO public.roles (id, name, description)
      VALUES (
        uuid_generate_v4(),
        'system-admin',
        'System administrator (same privileges as admin)'
      )
      ON CONFLICT (name) DO UPDATE
      SET description = EXCLUDED.description;
    END IF;
  END IF;
END $$;

DO $$
DECLARE
  v_admin_role_id UUID;
  v_system_admin_role_id UUID;
BEGIN
  IF to_regclass('public.permissions') IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'roles'
      AND column_name = 'department_id'
  ) THEN
    SELECT id INTO v_admin_role_id
    FROM public.roles
    WHERE name = 'admin'
      AND department_id IS NULL
    LIMIT 1;

    SELECT id INTO v_system_admin_role_id
    FROM public.roles
    WHERE name = 'system-admin'
      AND department_id IS NULL
    LIMIT 1;
  ELSE
    SELECT id INTO v_admin_role_id
    FROM public.roles
    WHERE name = 'admin'
    LIMIT 1;

    SELECT id INTO v_system_admin_role_id
    FROM public.roles
    WHERE name = 'system-admin'
    LIMIT 1;
  END IF;

  IF v_admin_role_id IS NULL OR v_system_admin_role_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.permissions (id, role_id, resource, action)
  SELECT
    uuid_generate_v4(),
    v_system_admin_role_id,
    resource,
    action
  FROM public.permissions
  WHERE role_id = v_admin_role_id
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

  IF to_regclass('public.permissions') IS NULL THEN
    RETURN false;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles up
    JOIN public.permissions p ON p.role_id = up.role_id
    WHERE up.user_id = v_user_id
      AND up.is_active = true
      AND p.resource = 'admin'
      AND p.action = 'system'
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
  IF to_regclass('public.permissions') IS NULL THEN
    RAISE EXCEPTION 'Access denied. Admin privileges required.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_profiles up_check
    JOIN public.permissions p ON p.role_id = up_check.role_id
    WHERE up_check.user_id = auth.uid()
      AND up_check.is_active = true
      AND p.resource = 'admin'
      AND p.action = 'system'
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
