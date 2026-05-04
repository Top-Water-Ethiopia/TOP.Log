-- Add role questions management permission
-- This allows admins to manage role-based and department-based questions

INSERT INTO permissions (
  id,
  name,
  resource,
  action,
  description,
  category,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'role_questions.manage',
  'role_questions',
  'manage',
  'Manage role-based and department-based questions',
  'write',
  NOW(),
  NOW()
);

-- Assign this permission to admin roles
INSERT INTO role_permissions (role_id, permission_id, created_at, updated_at)
SELECT 
  r.id,
  p.id,
  NOW(),
  NOW()
FROM roles r
CROSS JOIN permissions p
WHERE r.name IN ('admin', 'system-admin')
  AND p.name = 'role_questions.manage'
ON CONFLICT (role_id, permission_id) DO NOTHING;
