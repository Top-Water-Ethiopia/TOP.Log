-- Migration: Add super admin role
-- This migration adds a super admin role that has higher privileges than admin

-- Insert super admin role (using UUID that comes before admin in sort order)
INSERT INTO roles (id, name, description) 
VALUES 
  ('00000000-0000-0000-0000-000000000000', 'super-admin', 'Super Administrator with highest privileges, can create admin roles')
ON CONFLICT (name) DO NOTHING;

-- Grant super admin all permissions (same as admin for now, can be extended)
INSERT INTO permissions (id, role_id, resource, action)
SELECT 
  uuid_generate_v4(),
  '00000000-0000-0000-0000-000000000000'::UUID,
  resource,
  action
FROM permissions
WHERE role_id = '00000000-0000-0000-0000-000000000001'::UUID
ON CONFLICT DO NOTHING;






