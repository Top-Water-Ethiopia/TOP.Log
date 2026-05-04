-- Migration: Create move_member_atomic RPC function
-- Phase 4: Database function for atomic member movement

CREATE OR REPLACE FUNCTION move_member_atomic(
  p_user_id UUID,
  p_from_department_id UUID,
  p_to_department_id UUID,
  p_membership_type membership_type_enum,
  p_role_id UUID,
  p_is_primary BOOLEAN,
  p_performed_by UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_source_membership_id UUID;
BEGIN
  -- Validate: cannot move to same department
  IF p_from_department_id = p_to_department_id THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Source and target departments are the same'
    );
  END IF;

  -- 1. Deactivate SPECIFIC membership in source (scoped by type+role)
  UPDATE user_department_memberships
  SET is_active = FALSE,
      deactivated_at = NOW(),
      updated_at = NOW(),
      updated_by = p_performed_by
  WHERE user_id = p_user_id
    AND department_id = p_from_department_id
    AND membership_type = p_membership_type
    AND role_id = p_role_id
    AND is_active = TRUE
  RETURNING id INTO v_source_membership_id;

  -- If no membership was deactivated, return error
  IF v_source_membership_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'No active membership found to move'
    );
  END IF;

  -- 2. Deactivate conflicting membership in target (same type+role)
  UPDATE user_department_memberships
  SET is_active = FALSE,
      deactivated_at = NOW(),
      updated_at = NOW(),
      updated_by = p_performed_by
  WHERE user_id = p_user_id
    AND department_id = p_to_department_id
    AND membership_type = p_membership_type
    AND role_id = p_role_id
    AND is_active = TRUE;

  -- 3. Insert new membership (preserve primary status)
  INSERT INTO user_department_memberships (
    user_id, department_id, membership_type, role_id,
    is_active, is_primary, created_by, updated_by
  ) VALUES (
    p_user_id, p_to_department_id, p_membership_type, p_role_id,
    TRUE, p_is_primary, p_performed_by, p_performed_by
  );

  -- 4. Log per-membership audit event
  INSERT INTO membership_audit_log (
    user_id, from_department_id, to_department_id, membership_type, role_id, action, reason, performed_by
  ) VALUES (
    p_user_id, p_from_department_id, p_to_department_id,
    p_membership_type, p_role_id, 'moved', p_reason, p_performed_by
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'message', 'Member moved successfully',
    'source_membership_id', v_source_membership_id
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', SQLERRM,
      'detail', SQLSTATE
    );
END;
$$;
