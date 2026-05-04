-- Drop department_role_permissions table
-- This table is no longer needed since we've separated access levels from department roles
-- Permissions are now managed through department_access_levels and department_access_level_permissions

DROP TABLE IF EXISTS department_role_permissions;

-- Add a comment to document this change
COMMENT ON SCHEMA public IS 'Department role permissions table dropped - permissions now managed through access levels system';
