-- Migration: Add RPC functions for atomic membership operations (Part 2)
-- Phase 1: Foundation - move_member_atomic function

-- Function: Move member atomically (soft delete + create)
CREATE OR REPLACE FUNCTION move_member_atomic(
  p_user_id UUID,
  p_from_department_id UUID,
  p_to_department_id UUID,
  p_new_role VARCHAR(50),
  p_performed_by UUID,
  p_reason TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_membership JSONB;
  new_membership JSONB;
  should_be_primary BOOLEAN;
  v_new_id UUID;
BEGIN
  -- Get old membership data for snapshot
  SELECT to_jsonb(user_department_professions.*) INTO old_membership
  FROM user_department_professions
  WHERE user_id = p_user_id AND department_id = p_from_department_id;

  IF old_membership IS NULL THEN
    RAISE EXCEPTION 'Source membership not found';
  END IF;

  -- Determine if new membership should be primary
  SELECT NOT EXISTS(
    SELECT 1 FROM user_department_professions
    WHERE user_id = p_user_id AND is_primary = true AND is_active = true
  ) INTO should_be_primary;

  -- Soft delete old membership (preserve history)
  UPDATE user_department_professions
  SET is_active = false,
      is_primary = false,
      updated_at = NOW(),
      updated_by = p_performed_by,
      deactivated_at = NOW()
  WHERE user_id = p_user_id AND department_id = p_from_department_id;

  -- Create new membership
  INSERT INTO user_department_professions (
    user_id, department_id, role, is_active, is_primary,
    created_by, updated_by
  ) VALUES (
    p_user_id, p_to_department_id, p_new_role, true, should_be_primary,
    p_performed_by, p_performed_by
  )
  RETURNING id, to_jsonb(user_department_professions.*) INTO v_new_id, new_membership;

  -- Ensure primary exists after move (edge case: if no primary was set)
  IF NOT should_be_primary THEN
    IF NOT EXISTS (
      SELECT 1 FROM user_department_professions
      WHERE user_id = p_user_id AND is_primary = true AND is_active = true
    ) THEN
      UPDATE user_department_professions
      SET is_primary = true
      WHERE id = v_new_id;

      should_be_primary := true;
    END IF;
  END IF;

  -- Log the move event (manual insert since trigger won't catch this complex operation)
  INSERT INTO user_department_profession_events (
    membership_id, user_id, department_id, action,
    previous_role, new_role, previous_is_active, new_is_active,
    previous_is_primary, new_is_primary, deleted_snapshot, reason, performed_by
  ) VALUES (
    v_new_id, p_user_id, p_to_department_id, 'moved',
    old_membership->>'role', p_new_role,
    (old_membership->>'is_active')::BOOLEAN, true,
    (old_membership->>'is_primary')::BOOLEAN, should_be_primary,
    old_membership, p_reason, p_performed_by
  );

  RETURN jsonb_build_object(
    'success', true,
    'new_membership', new_membership,
    'became_primary', should_be_primary
  );
END;
$$;

