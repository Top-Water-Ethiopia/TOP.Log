-- Migration: Cleanup Old Membership Tables
-- Date: 2026-04-13
-- Description: Drop legacy tables after successful migration to unified membership system
-- Note: All data has been migrated to user_department_memberships, roles, and membership_audit_log

-- Drop triggers first (if any remain)
DROP TRIGGER IF EXISTS trg_auto_deactivate_other_memberships ON user_department_professions;
DROP TRIGGER IF EXISTS trg_log_membership_events ON user_department_professions;
DROP TRIGGER IF EXISTS trg_set_membership_updated_at ON user_department_professions;
DROP TRIGGER IF EXISTS trg_access_level_membership_events ON user_department_access_levels;

-- Drop functions that reference old tables
DROP FUNCTION IF EXISTS handle_membership_primary_change() CASCADE;
DROP FUNCTION IF EXISTS handle_auto_deactivate_other_memberships() CASCADE;
DROP FUNCTION IF EXISTS log_membership_event() CASCADE;
DROP FUNCTION IF EXISTS set_membership_updated_at() CASCADE;
DROP FUNCTION IF EXISTS handle_access_level_membership_event() CASCADE;

-- Drop RLS policies on old tables
DROP POLICY IF EXISTS "Allow admin full access" ON user_department_professions;
DROP POLICY IF EXISTS "Allow users to read their own" ON user_department_professions;
DROP POLICY IF EXISTS "Allow admin full access" ON user_department_access_levels;
DROP POLICY IF EXISTS "Allow users to read their own access levels" ON user_department_access_levels;

-- Drop the old audit/events table
DROP TABLE IF EXISTS user_department_profession_events;

-- Drop old membership tables (in dependency order)
DROP TABLE IF EXISTS user_department_professions CASCADE;
DROP TABLE IF EXISTS user_department_access_levels CASCADE;

-- Drop old permission/level tables
DROP TABLE IF EXISTS department_access_level_permissions CASCADE;
DROP TABLE IF EXISTS department_access_levels CASCADE;
DROP TABLE IF EXISTS department_professions CASCADE;

-- Add comment documenting the migration
COMMENT ON TABLE user_department_memberships IS 'Unified membership table. Migrated from user_department_professions and user_department_access_levels on 2026-04-13.';
COMMENT ON TABLE roles IS 'Unified roles table. Migrated from department_professions and department_access_levels on 2026-04-13.';
COMMENT ON TABLE membership_audit_log IS 'Audit log for membership lifecycle. Replaces user_department_profession_events on 2026-04-13.';
