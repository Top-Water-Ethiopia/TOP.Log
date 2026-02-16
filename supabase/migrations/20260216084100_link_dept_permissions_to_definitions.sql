-- Migration: Link department_access_level_permissions to permission_definitions
-- This replaces inline resource/action columns with a FK to the unified permission catalog

BEGIN;

-- 1. Add FK column to reference permission_definitions
ALTER TABLE department_access_level_permissions
ADD COLUMN IF NOT EXISTS permission_definition_id UUID;

-- 2. Populate FK from existing resource/action data
UPDATE department_access_level_permissions d
SET permission_definition_id = pd.id
FROM permission_definitions pd
WHERE d.resource = pd.resource
  AND d.action = pd.action;

-- 3. For any orphaned records (resource/action not in permission_definitions), insert them first
INSERT INTO permission_definitions (resource, action, description, scope)
SELECT DISTINCT
  d.resource,
  d.action,
  'Auto-migrated from department access level permissions' as description,
  'department' as scope
FROM department_access_level_permissions d
WHERE d.permission_definition_id IS NULL
ON CONFLICT (resource, action) DO NOTHING;

-- 4. Re-populate FK for the newly inserted records
UPDATE department_access_level_permissions d
SET permission_definition_id = pd.id
FROM permission_definitions pd
WHERE d.resource = pd.resource
  AND d.action = pd.action
  AND d.permission_definition_id IS NULL;

-- 5. Make FK required now that all data is migrated
ALTER TABLE department_access_level_permissions
ALTER COLUMN permission_definition_id SET NOT NULL;

-- 6. Add FK constraint
ALTER TABLE department_access_level_permissions
ADD CONSTRAINT dept_access_level_perm_def_fk
FOREIGN KEY (permission_definition_id)
REFERENCES permission_definitions(id)
ON DELETE CASCADE;

-- 7. Drop old unique constraint and recreate with FK
ALTER TABLE department_access_level_permissions
DROP CONSTRAINT IF EXISTS department_access_level_permissions_unique;

ALTER TABLE department_access_level_permissions
DROP CONSTRAINT IF EXISTS dept_access_level_perm_unique;

ALTER TABLE department_access_level_permissions
ADD CONSTRAINT dept_access_level_perm_unique
UNIQUE (access_level_id, permission_definition_id);

-- 8. Drop old resource/action columns
ALTER TABLE department_access_level_permissions
DROP COLUMN IF EXISTS resource,
DROP COLUMN IF EXISTS action;

COMMIT;
