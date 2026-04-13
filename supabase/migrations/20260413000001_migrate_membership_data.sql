-- Migration: Migrate Existing Data to Unified Membership System
-- Phase 1.5: Data migration from old tables to new unified schema

-- Drop old constraint if still exists (from previous failed migrations)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'roles_name_unique') THEN
    ALTER TABLE roles DROP CONSTRAINT IF EXISTS roles_name_unique;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'roles_name_unique') THEN
    DROP INDEX IF EXISTS roles_name_unique;
  END IF;
END$$;

-- Ensure the validation trigger compares enum values safely before inserts run.
CREATE OR REPLACE FUNCTION validate_membership_role_type()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM roles
    WHERE id = NEW.role_id
      AND type::text = NEW.membership_type::text
  ) THEN
    RAISE EXCEPTION 'Role type mismatch: role.type does not match membership.membership_type';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 1: Insert access levels as system-wide roles
-- ============================================================================

INSERT INTO roles (type, scope, name, display_name, description, level)
SELECT
  'access_level'::role_type_enum as type,
  'system'::role_scope_enum as scope,
  dal.name,
  dal.display_name,
  dal.description,
  dal.level
FROM department_access_levels dal
WHERE dal.is_active = TRUE
  AND NOT EXISTS (
    SELECT 1 FROM roles r
    WHERE r.type = 'access_level'::role_type_enum
      AND r.scope = 'system'::role_scope_enum
      AND r.department_id IS NULL
      AND r.name = dal.name
  );

-- ============================================================================
-- STEP 2: Insert department professions as department-scoped roles
-- ============================================================================

INSERT INTO roles (type, scope, department_id, name, display_name, is_active, is_default)
SELECT
  'profession'::role_type_enum as type,
  'department'::role_scope_enum as scope,
  dp.department_id,
  dp.key as name,
  dp.label as display_name,
  dp.is_active,
  dp.is_default
FROM department_professions dp
WHERE NOT EXISTS (
  SELECT 1 FROM roles r
  WHERE r.type = 'profession'::role_type_enum
    AND r.scope = 'department'::role_scope_enum
    AND r.department_id = dp.department_id
    AND r.name = dp.key
);

-- ============================================================================
-- STEP 3: Migrate access level memberships
-- ============================================================================

INSERT INTO user_department_memberships (
  user_id, department_id, membership_type, role_id,
  is_active, is_primary, created_at, updated_at
)
SELECT
  udal.user_id,
  udal.department_id,
  'access_level'::membership_type_enum as membership_type,
  r.id as role_id,
  TRUE as is_active,
  FALSE as is_primary,
  udal.created_at,
  udal.updated_at
FROM user_department_access_levels udal
JOIN department_access_levels dal ON udal.access_level_id = dal.id
JOIN roles r ON r.name = dal.name 
  AND r.type = 'access_level'::role_type_enum 
  AND r.scope = 'system'::role_scope_enum
WHERE NOT EXISTS (
  SELECT 1 FROM user_department_memberships udm
  WHERE udm.user_id = udal.user_id
    AND udm.department_id = udal.department_id
    AND udm.membership_type = 'access_level'::membership_type_enum
    AND udm.role_id = r.id
    AND udm.is_active = TRUE
);

-- ============================================================================
-- STEP 4: Migrate profession memberships
-- ============================================================================

INSERT INTO user_department_memberships (
  user_id, department_id, membership_type, role_id,
  is_active, is_primary, deactivated_at, created_at, updated_at
)
SELECT
  udp.user_id,
  udp.department_id,
  'profession'::membership_type_enum as membership_type,
  r.id as role_id,
  udp.is_active,
  udp.is_primary,
  udp.deactivated_at,
  udp.created_at,
  udp.updated_at
FROM user_department_professions udp
JOIN department_professions dp ON udp.role = dp.key AND udp.department_id = dp.department_id
JOIN roles r ON r.name = dp.key 
  AND r.department_id = dp.department_id 
  AND r.type = 'profession'::role_type_enum
  AND r.scope = 'department'::role_scope_enum
WHERE NOT EXISTS (
  SELECT 1 FROM user_department_memberships udm
  WHERE udm.user_id = udp.user_id
    AND udm.department_id = udp.department_id
    AND udm.membership_type = 'profession'::membership_type_enum
    AND udm.role_id = r.id
    AND udm.is_active = TRUE
);

-- ============================================================================
-- STEP 5: Migrate permissions from access levels
-- ============================================================================

INSERT INTO role_permissions (role_id, resource, action)
SELECT
  r.id as role_id,
  pd.resource,
  pd.action
FROM department_access_level_permissions dalp
JOIN permission_definitions pd ON dalp.permission_definition_id = pd.id
JOIN department_access_levels dal ON dalp.access_level_id = dal.id
JOIN roles r ON r.name = dal.name 
  AND r.type = 'access_level'::role_type_enum
  AND r.scope = 'system'::role_scope_enum
WHERE NOT EXISTS (
  SELECT 1 FROM role_permissions rp
  WHERE rp.role_id = r.id
    AND rp.resource = pd.resource
    AND rp.action = pd.action
);

-- ============================================================================
-- STEP 6: Handle primary membership conflicts
-- If a user has multiple is_primary=TRUE, keep only one
-- ============================================================================

WITH ranked_primaries AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY user_id 
           ORDER BY is_primary DESC, updated_at DESC NULLS LAST
         ) as rn
  FROM user_department_memberships
  WHERE is_primary = TRUE
)
UPDATE user_department_memberships
SET is_primary = FALSE
WHERE id IN (
  SELECT id FROM ranked_primaries WHERE rn > 1
);

-- STEP 7 intentionally omitted.
-- membership_audit_log requires a non-null user_id, so a synthetic "migration complete"
-- row is not inserted here.
