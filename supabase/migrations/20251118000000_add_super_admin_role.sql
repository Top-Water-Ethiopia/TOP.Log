-- Migration: Add super admin role
-- This migration adds a super admin role that has higher privileges than admin

-- Insert super admin role (using UUID that comes before admin in sort order)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

INSERT INTO roles (id, name, description)
SELECT
  uuid_generate_v4(),
  'super-admin',
  'Super Administrator with highest privileges, can create admin roles'
WHERE NOT EXISTS (
  SELECT 1
  FROM roles
  WHERE name = 'super-admin'
);

-- Grant super admin all permissions (same as admin for now, can be extended)
DO $$
DECLARE
  v_admin_role_id UUID;
  v_super_admin_role_id UUID;
BEGIN
  IF to_regclass('public.permissions') IS NULL THEN
    RETURN;
  END IF;

  SELECT id INTO v_admin_role_id
  FROM public.roles
  WHERE name = 'admin'
  LIMIT 1;

  SELECT id INTO v_super_admin_role_id
  FROM public.roles
  WHERE name = 'super-admin'
  LIMIT 1;

  IF v_admin_role_id IS NULL OR v_super_admin_role_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.permissions (id, role_id, resource, action)
  SELECT
    uuid_generate_v4(),
    v_super_admin_role_id,
    resource,
    action
  FROM public.permissions
  WHERE role_id = v_admin_role_id
  ON CONFLICT DO NOTHING;
END $$;






