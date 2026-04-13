-- Migration: Create membership audit table and triggers
-- Phase 1: Foundation - Audit logging

BEGIN;

-- 1. Create audit events table
CREATE TABLE IF NOT EXISTS user_department_profession_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  membership_id UUID, -- NULL for hard deletes (row no longer exists)
  user_id UUID NOT NULL,
  department_id UUID NOT NULL,
  action VARCHAR(50) NOT NULL, -- 'created', 'activated', 'deactivated', 'role_changed', 'primary_changed', 'hard_deleted', 'moved', 'system_repair_primary'
  previous_role VARCHAR(50),
  new_role VARCHAR(50),
  previous_is_active BOOLEAN,
  new_is_active BOOLEAN,
  previous_is_primary BOOLEAN,
  new_is_primary BOOLEAN,
  deleted_snapshot JSONB, -- Full row snapshot for hard deletes
  reason TEXT, -- optional admin-provided reason
  performed_by UUID REFERENCES auth.users(id),
  performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT
);

-- 2. Indexes for audit table
CREATE INDEX IF NOT EXISTS idx_membership_events_membership 
  ON user_department_profession_events(membership_id);
CREATE INDEX IF NOT EXISTS idx_membership_events_user 
  ON user_department_profession_events(user_id);
CREATE INDEX IF NOT EXISTS idx_membership_events_performed_at 
  ON user_department_profession_events(performed_at);
CREATE INDEX IF NOT EXISTS idx_membership_events_action 
  ON user_department_profession_events(action);

-- 3. Archive table for old events
CREATE TABLE IF NOT EXISTS user_department_profession_events_archive (
  LIKE user_department_profession_events INCLUDING ALL,
  archived_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Trigger function: Log membership changes to audit table
CREATE OR REPLACE FUNCTION log_membership_changes()
RETURNS trigger AS $$
BEGIN
  -- Only log if relevant fields changed
  IF TG_OP = 'INSERT' OR 
     OLD.role IS DISTINCT FROM NEW.role OR
     OLD.is_active IS DISTINCT FROM NEW.is_active OR
     OLD.is_primary IS DISTINCT FROM NEW.is_primary THEN
    
    INSERT INTO user_department_profession_events (
      membership_id, user_id, department_id, action,
      previous_role, new_role,
      previous_is_active, new_is_active,
      previous_is_primary, new_is_primary,
      performed_by
    ) VALUES (
      NEW.id, NEW.user_id, NEW.department_id,
      CASE
        WHEN TG_OP = 'INSERT' THEN 'created'
        WHEN OLD.is_active = true AND NEW.is_active = false THEN 'deactivated'
        WHEN OLD.is_active = false AND NEW.is_active = true THEN 'activated'
        WHEN OLD.role IS DISTINCT FROM NEW.role THEN 'role_changed'
        WHEN OLD.is_primary IS DISTINCT FROM NEW.is_primary THEN 'primary_changed'
        ELSE 'updated'
      END,
      OLD.role, NEW.role,
      OLD.is_active, NEW.is_active,
      OLD.is_primary, NEW.is_primary,
      COALESCE(NEW.updated_by, auth.uid())
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Trigger: Auto-log changes after insert or update
DROP TRIGGER IF EXISTS trg_log_membership_changes 
  ON user_department_professions;
CREATE TRIGGER trg_log_membership_changes
  AFTER INSERT OR UPDATE ON user_department_professions
  FOR EACH ROW
  EXECUTE FUNCTION log_membership_changes();

-- 6. Function: Archive old membership events (run monthly)
CREATE OR REPLACE FUNCTION archive_old_membership_events(p_days INTEGER DEFAULT 90)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  archived_count INTEGER;
BEGIN
  -- Move events older than p_days to archive
  WITH moved AS (
    DELETE FROM user_department_profession_events
    WHERE performed_at < NOW() - INTERVAL '1 day' * p_days
    RETURNING *
  )
  INSERT INTO user_department_profession_events_archive
  SELECT * FROM moved;
  
  GET DIAGNOSTICS archived_count = ROW_COUNT;
  RETURN archived_count;
END;
$$;

-- 7. Function: Validate primary existence (returns users with active memberships but no primary)
CREATE OR REPLACE FUNCTION validate_primary_existence()
RETURNS TABLE(user_id UUID, active_count INTEGER, primary_count INTEGER)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    udp.user_id,
    COUNT(*) FILTER (WHERE udp.is_active)::INTEGER as active_count,
    COUNT(*) FILTER (WHERE udp.is_active AND udp.is_primary)::INTEGER as primary_count
  FROM user_department_professions udp
  GROUP BY udp.user_id
  HAVING 
    COUNT(*) FILTER (WHERE udp.is_active) > 0  -- Has active memberships
    AND COUNT(*) FILTER (WHERE udp.is_active AND udp.is_primary) = 0;  -- But no primary
END;
$$;

-- 8. Function: Auto-repair missing primary (run nightly)
CREATE OR REPLACE FUNCTION repair_missing_primary()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  fixed_count INTEGER := 0;
  rec RECORD;
BEGIN
  FOR rec IN SELECT * FROM validate_primary_existence()
  LOOP
    -- Promote most recently updated active membership to primary
    UPDATE user_department_professions
    SET is_primary = true, updated_at = NOW()
    WHERE id = (
      SELECT id FROM user_department_professions
      WHERE user_id = rec.user_id AND is_active = true
      ORDER BY updated_at DESC
      LIMIT 1
    );
    
    fixed_count := fixed_count + 1;
    
    -- Log repair action explicitly
    INSERT INTO user_department_profession_events (
      membership_id, user_id, department_id, action,
      previous_is_primary, new_is_primary, reason, performed_by
    )
    SELECT 
      id, user_id, department_id, 'system_repair_primary',
      false, true, 'System repair: no primary existed', '00000000-0000-0000-0000-000000000000'
    FROM user_department_professions
    WHERE user_id = rec.user_id AND is_primary = true;
  END LOOP;
  
  RETURN fixed_count;
END;
$$;

-- 9. RLS policies for audit table
ALTER TABLE user_department_profession_events ENABLE ROW LEVEL SECURITY;

-- Admins can view all audit events
CREATE POLICY "Admins can view all audit events"
  ON user_department_profession_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND role_id IN ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010')
    )
  );

-- Users can view their own audit events
CREATE POLICY "Users can view their own audit events"
  ON user_department_profession_events FOR SELECT
  USING (user_id = auth.uid());

COMMIT;
