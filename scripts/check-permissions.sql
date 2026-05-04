-- Check existing role_questions permissions
SELECT 
  p.name,
  p.resource,
  p.action,
  p.description,
  p.category
FROM permissions p
WHERE p.resource = 'role_questions' OR p.name LIKE '%role_questions%'
ORDER BY p.name;

-- Check what permissions admin users have
SELECT 
  r.name as role_name,
  p.name as permission_name,
  p.resource,
  p.action
FROM roles r
JOIN role_permissions rp ON r.id = rp.role_id
JOIN permissions p ON rp.permission_id = p.id
WHERE r.name IN ('admin', 'system-admin')
ORDER BY r.name, p.name;
