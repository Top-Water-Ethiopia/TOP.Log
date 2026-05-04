-- Migration: Add RPC functions for atomic membership operations (Part 1)
-- Phase 1: Foundation - update_membership_with_primary function

-- Function: Update membership with primary handling (atomic)
CREATE OR REPLACE FUNCTION update_membership_with_primary(
  p_department_id UUID,
  p_user_id UUID,
  p_updates JSONB,
  p_performed_by UUID,
  p_reason TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
  v_role VARCHAR(50);
  v_is_active BOOLEAN;
  v_is_primary BOOLEAN;
  v_old_membership RECORD;
BEGIN
  -- Get current membership state
  SELECT * INTO v_old_membership
  FROM user_department_professions
  WHERE department_id = p_department_id AND user_id = p_user_id;
  
  IF v_old_membership IS NULL THEN
    RAISE EXCEPTION 'Membership not found';
  END IF;
  
  -- Extract update values
  v_role := COALESCE((p_updates->>'role')::VARCHAR, v_old_membership.role);
  v_is_active := COALESCE((p_updates->>'is_active')::BOOLEAN, v_old_membership.is_active);
  v_is_primary := COALESCE((p_updates->>'is_primary')::BOOLEAN, v_old_membership.is_primary);
  
  -- If setting is_primary = true, first demote existing primary
  IF v_is_primary AND NOT v_old_membership.is_primary THEN
    UPDATE user_department_professions
    SET is_primary = false, 
        updated_at = NOW(), 
        updated_by = p_performed_by
    WHERE user_id = p_user_id
      AND is_primary = true
      AND department_id != p_department_id;
  END IF;
  
  -- Handle primary reassignment on deactivate
  IF v_old_membership.is_primary AND NOT v_is_active THEN
    -- Count other active memberships
    DECLARE
      v_other_active_count INTEGER;
      v_auto_promote_id UUID;
    BEGIN
      SELECT COUNT(*), 
             (SELECT id FROM user_department_professions 
              WHERE user_id = p_user_id 
                AND is_active = true 
                AND department_id != p_department_id
              ORDER BY updated_at DESC
              LIMIT 1)
      INTO v_other_active_count, v_auto_promote_id
      FROM user_department_professions
      WHERE user_id = p_user_id 
        AND is_active = true 
        AND department_id != p_department_id;
      
      -- Auto-promote if exactly 1 other active membership
      IF v_other_active_count = 1 AND v_auto_promote_id IS NOT NULL THEN
        UPDATE user_department_professions
        SET is_primary = true, updated_at = NOW(), updated_by = p_performed_by
        WHERE id = v_auto_promote_id;
      END IF;
      
      -- Note: If 0 or 2+ other memberships, admin must handle via UI
    END;
  END IF;
  
  -- Apply the requested update
  UPDATE user_department_professions
  SET 
    role = v_role,
    is_active = v_is_active,
    is_primary = v_is_primary,
    updated_at = NOW(),
    updated_by = p_performed_by,
    deactivated_at = CASE 
      WHEN v_is_active = false AND v_old_membership.is_active = true THEN NOW()
      WHEN v_is_active = true THEN NULL
      ELSE v_old_membership.deactivated_at
    END
  WHERE department_id = p_department_id AND user_id = p_user_id
  RETURNING to_jsonb(user_department_professions.*) INTO result;
  
  RETURN result;
END;
$$;

