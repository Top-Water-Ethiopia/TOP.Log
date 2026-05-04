-- Migration: Add is_primary and deactivated_at to user_department_professions
-- Phase 1: Foundation - Primary department support

BEGIN;

-- 1. Add new columns
ALTER TABLE user_department_professions 
ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id);

-- 2. Partial unique index: only one primary per user
CREATE UNIQUE INDEX IF NOT EXISTS user_department_professions_one_primary_per_user
  ON user_department_professions (user_id) 
  WHERE is_primary = true;

-- 3. Composite index for common lookups
CREATE INDEX IF NOT EXISTS idx_udp_user_dept_active
  ON user_department_professions(user_id, department_id, is_active, is_primary)
  WHERE is_active = true;

-- 4. Index for permission queries
CREATE INDEX IF NOT EXISTS idx_udp_user_active_role
  ON user_department_professions(user_id, role)
  WHERE is_active = true;

-- 5. Backfill: Set first active membership per user as primary
WITH first_active AS (
  SELECT DISTINCT ON (user_id) 
    id,
    user_id
  FROM user_department_professions
  WHERE is_active = true
  ORDER BY user_id, updated_at DESC
)
UPDATE user_department_professions udp
SET is_primary = true
FROM first_active fa
WHERE udp.id = fa.id;

-- 6. Backfill: Set deactivated_at for existing inactive memberships
UPDATE user_department_professions
SET deactivated_at = updated_at
WHERE is_active = false AND deactivated_at IS NULL;

COMMIT;
