-- Seed marketing_agents.delete_permanent permission and assign to admin roles
-- This permission enables the Danger Zone hard delete feature in the UI

-- Assign to super-admin role
INSERT INTO role_permissions (role_id, resource, action, effect)
SELECT 
  r.id,
  'marketing_agents',
  'delete_permanent',
  'allow'
FROM roles r
WHERE r.name = 'super-admin'
ON CONFLICT (role_id, resource, action) DO NOTHING;

-- Assign to admin role
INSERT INTO role_permissions (role_id, resource, action, effect)
SELECT 
  r.id,
  'marketing_agents',
  'delete_permanent',
  'allow'
FROM roles r
WHERE r.name = 'admin'
ON CONFLICT (role_id, resource, action) DO NOTHING;

-- Assign to system-admin role
INSERT INTO role_permissions (role_id, resource, action, effect)
SELECT 
  r.id,
  'marketing_agents',
  'delete_permanent',
  'allow'
FROM roles r
WHERE r.name = 'system-admin'
ON CONFLICT (role_id, resource, action) DO NOTHING;
