-- Seed default permissions, roles, and access scopes into the database
-- This migration populates the RBAC system with all default values from lib/rbac/types.ts

BEGIN;

-- Create UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Seed default permissions
INSERT INTO permission_definitions (resource, action, description)
VALUES
  -- Entry permissions
  ('entries', 'create', 'Create new log entries'),
  ('entries', 'read', 'View log entries'),
  ('entries', 'update', 'Update existing log entries'),
  ('entries', 'delete', 'Delete log entries'),
  ('entries', 'export', 'Export all log entries'),
  ('entries', 'export.own', 'Export own log entries'),
  ('entries', 'import', 'Import log entries'),
  ('entries', 'delete.own', 'Delete own log entries'),

  -- Reports permissions
  ('reports', 'read', 'View reports'),
  ('reports', 'export', 'Export reports'),
  ('reports', 'delete', 'Delete reports'),

  -- User permissions
  ('users', 'create', 'Create new users'),
  ('users', 'read', 'View user information'),
  ('users', 'update', 'Update user information'),
  ('users', 'delete', 'Delete users'),
  ('users', 'manage', 'Manage user roles and permissions'),

  -- Department permissions
  ('departments', 'create', 'Create departments'),
  ('departments', 'read', 'View departments'),
  ('departments', 'update', 'Update department details'),
  ('departments', 'delete', 'Delete departments'),
  ('departments', 'members.read', 'View department members'),
  ('departments', 'members.manage', 'Add/remove department members'),

  -- Analytics permissions
  ('analytics', 'read', 'View analytics dashboard'),
  ('analytics', 'read.own', 'View own analytics'),
  ('analytics', 'advanced', 'View advanced analytics'),
  ('analytics', 'team', 'View team analytics'),

  -- Admin permissions
  ('admin', 'system', 'Access system administration'),
  ('admin', 'audit', 'View audit logs'),
  ('admin', 'backup', 'Create system backups'),
  ('admin', 'restore', 'Restore system backups'),
  ('admin', 'settings', 'Manage system settings')
ON CONFLICT (resource, action) DO NOTHING;

-- 2. Seed permissions for existing system roles (by role name)
DO $$
DECLARE
  v_role_id UUID;
  v_role_name TEXT;
BEGIN
  FOREACH v_role_name IN ARRAY ARRAY['admin', 'system-admin', 'super-admin']
  LOOP
    SELECT r.id
    INTO v_role_id
    FROM public.roles r
    WHERE r.name = v_role_name
    LIMIT 1;

    IF v_role_id IS NOT NULL THEN
      INSERT INTO public.permissions (id, role_id, resource, action)
      SELECT
        uuid_generate_v4(),
        v_role_id,
        pd.resource,
        pd.action
      FROM public.permission_definitions pd
      ON CONFLICT (role_id, resource, action) DO NOTHING;
    END IF;
  END LOOP;
END;
$$;

COMMIT;
