-- Migration: Unify Department Membership System
-- Phase 1: Create new unified tables (roles, user_department_memberships, role_permissions, audit_log)
-- This migration creates the foundation for merging user_department_professions and user_department_access_levels

-- ============================================================================
-- 1. CREATE ENUM TYPES
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'membership_type_enum') THEN
    CREATE TYPE membership_type_enum AS ENUM ('profession', 'access_level');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'role_type_enum') THEN
    CREATE TYPE role_type_enum AS ENUM ('profession', 'access_level');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'role_scope_enum') THEN
    CREATE TYPE role_scope_enum AS ENUM ('department', 'system');
  END IF;
END$$;

-- ============================================================================
-- 2. UPDATE EXISTING ROLES TABLE
-- ============================================================================

-- Add missing columns to existing roles table if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'roles' AND column_name = 'type') THEN
    ALTER TABLE roles ADD COLUMN type role_type_enum NOT NULL DEFAULT 'profession';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'roles' AND column_name = 'scope') THEN
    ALTER TABLE roles ADD COLUMN scope role_scope_enum NOT NULL DEFAULT 'department';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'roles' AND column_name = 'department_id') THEN
    ALTER TABLE roles ADD COLUMN department_id UUID REFERENCES departments(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'roles' AND column_name = 'level') THEN
    ALTER TABLE roles ADD COLUMN level INTEGER CHECK (level BETWEEN 1 AND 10);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'roles' AND column_name = 'sort_order') THEN
    ALTER TABLE roles ADD COLUMN sort_order INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'roles' AND column_name = 'is_active') THEN
    ALTER TABLE roles ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'roles' AND column_name = 'is_default') THEN
    ALTER TABLE roles ADD COLUMN is_default BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'roles' AND column_name = 'display_name') THEN
    ALTER TABLE roles ADD COLUMN display_name TEXT;
    UPDATE roles SET display_name = COALESCE(name, 'Unnamed Role') WHERE display_name IS NULL;
    ALTER TABLE roles ALTER COLUMN display_name SET NOT NULL;
  END IF;
END$$;

-- Indexes for roles (create if not exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_roles_type') THEN
    CREATE INDEX idx_roles_type ON roles(type);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_roles_dept') THEN
    CREATE INDEX idx_roles_dept ON roles(department_id) WHERE department_id IS NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_roles_active') THEN
    CREATE INDEX idx_roles_active ON roles(is_active) WHERE is_active = TRUE;
  END IF;
END$$;

-- Fix unique constraint on roles to be composite
-- Drop old simple unique constraint if exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'roles_name_unique') THEN
    DROP INDEX IF EXISTS roles_name_unique;
  END IF;
  -- Add composite unique constraint if not exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'roles_type_scope_dept_name_unique'
  ) THEN
    CREATE UNIQUE INDEX roles_type_scope_dept_name_unique 
    ON roles(type, scope, COALESCE(department_id, '00000000-0000-0000-0000-000000000000'), name);
  END IF;
END$$;

-- Ensure is_admin function exists
CREATE OR REPLACE FUNCTION is_admin(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_id = p_user_id AND is_admin = TRUE
  );
END;
$$;

-- RLS for roles
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies to ensure they exist
DROP POLICY IF EXISTS "roles_select_all" ON roles;
DROP POLICY IF EXISTS "roles_modify_admin" ON roles;

CREATE POLICY "roles_select_all"
  ON roles FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "roles_modify_admin"
  ON roles FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()));

-- ============================================================================
-- 3. CREATE UNIFIED MEMBERSHIPS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_department_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  membership_type membership_type_enum NOT NULL,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  last_used_at TIMESTAMPTZ,
  deactivated_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for memberships
CREATE INDEX idx_udp_memberships_user ON user_department_memberships(user_id);
CREATE INDEX idx_udp_memberships_dept ON user_department_memberships(department_id);
CREATE INDEX idx_udp_memberships_active ON user_department_memberships(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_udp_memberships_type ON user_department_memberships(membership_type);
CREATE INDEX idx_udp_memberships_user_dept ON user_department_memberships(user_id, department_id);

-- Constraints
-- One primary membership GLOBALLY per user (defines login context)
CREATE UNIQUE INDEX idx_one_primary_per_user
  ON user_department_memberships(user_id) WHERE is_primary = TRUE AND is_active = TRUE;

-- Prevent duplicate active memberships
CREATE UNIQUE INDEX idx_no_duplicate_memberships
  ON user_department_memberships(user_id, department_id, membership_type, role_id)
  WHERE is_active = TRUE;

-- CHECK constraints
ALTER TABLE user_department_memberships
  ADD CONSTRAINT chk_primary_must_be_profession
  CHECK (is_primary = FALSE OR membership_type = 'profession');

ALTER TABLE user_department_memberships
  ADD CONSTRAINT chk_primary_must_be_active
  CHECK (is_primary = FALSE OR is_active = TRUE);

-- RLS for memberships
ALTER TABLE user_department_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "memberships_select_own"
  ON user_department_memberships FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "memberships_select_admin"
  ON user_department_memberships FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "memberships_modify_admin"
  ON user_department_memberships FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()));

-- ============================================================================
-- 4. CREATE ROLE PERMISSIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  resource TEXT NOT NULL,
  action TEXT NOT NULL,
  effect TEXT NOT NULL DEFAULT 'allow' CHECK (effect IN ('allow', 'deny')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(role_id, resource, action)
);

CREATE INDEX idx_role_permissions_role ON role_permissions(role_id);

ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "role_permissions_select_all"
  ON role_permissions FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "role_permissions_modify_admin"
  ON role_permissions FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()));

-- ============================================================================
-- 5. CREATE AUDIT LOG TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS membership_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  to_department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  membership_type membership_type_enum,
  role_id UUID REFERENCES roles(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN (
    'moved', 'activated', 'deactivated', 'created',
    'primary_assigned', 'primary_removed', 'primary_auto_promoted'
  )),
  reason TEXT,
  performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_user ON membership_audit_log(user_id);
CREATE INDEX idx_audit_log_created ON membership_audit_log(created_at);

ALTER TABLE membership_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_select_own"
  ON membership_audit_log FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "audit_log_select_admin"
  ON membership_audit_log FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));

-- ============================================================================
-- 6. CREATE TRIGGERS FOR PRIMARY MEMBERSHIP MANAGEMENT
-- ============================================================================

-- Trigger: On primary membership deactivation, auto-promote fallback
CREATE OR REPLACE FUNCTION handle_primary_deactivation()
RETURNS TRIGGER AS $$
DECLARE
  v_fallback_id UUID;
BEGIN
  IF OLD.is_primary = TRUE AND NEW.is_active = FALSE THEN
    -- Find fallback profession membership
    SELECT id INTO v_fallback_id
    FROM user_department_memberships
    WHERE user_id = NEW.user_id
      AND is_active = TRUE
      AND membership_type = 'profession'
      AND id != NEW.id
    ORDER BY is_primary DESC, last_used_at DESC NULLS LAST, created_at DESC
    LIMIT 1;

    IF v_fallback_id IS NOT NULL THEN
      UPDATE user_department_memberships
      SET is_primary = TRUE,
          updated_at = NOW()
      WHERE id = v_fallback_id
        AND is_primary = FALSE;

      -- Log the auto-promotion
      INSERT INTO membership_audit_log (
        user_id, from_dept, to_dept, membership_type, role_id,
        action, reason, performed_by
      ) VALUES (
        NEW.user_id, NULL, NULL, NEW.membership_type, NEW.role_id,
        'primary_auto_promoted',
        'Previous primary was deactivated',
        COALESCE(NEW.updated_by, auth.uid())
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_handle_primary_deactivation
  AFTER UPDATE ON user_department_memberships
  FOR EACH ROW
  WHEN (OLD.is_active = TRUE AND NEW.is_active = FALSE)
  EXECUTE FUNCTION handle_primary_deactivation();

-- Trigger: Update last_used_at on activity
CREATE OR REPLACE FUNCTION update_last_used()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_used_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_last_used
  BEFORE UPDATE ON user_department_memberships
  FOR EACH ROW
  WHEN (NEW.is_active = TRUE AND OLD.is_active = TRUE)
  EXECUTE FUNCTION update_last_used();

-- ============================================================================
-- 7. VALIDATION TRIGGER: membership_type must match role.type
-- ============================================================================

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

CREATE TRIGGER trg_validate_membership_role
  BEFORE INSERT OR UPDATE ON user_department_memberships
  FOR EACH ROW
  EXECUTE FUNCTION validate_membership_role_type();
