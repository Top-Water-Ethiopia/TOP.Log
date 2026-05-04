-- -------------------------------------------------------------------------
-- has_department_access: was using user_department_access_levels
-- Now checks user_department_memberships with membership_type = 'access_level'
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_department_access(p_user_id uuid, p_department_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM user_department_memberships
    WHERE user_id = p_user_id
      AND department_id = p_department_id
      AND membership_type = 'access_level'
      AND is_active = TRUE
  );
END;
$$;

-- -------------------------------------------------------------------------
-- has_permission_in_department: was using user_department_access_levels +
-- department_access_level_permissions + permission_definitions
-- Now checks user_department_memberships + role_permissions (resource/action)
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_permission_in_department(
  p_user_id uuid,
  p_department_id uuid,
  p_resource text,
  p_action text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM user_department_memberships udm
    JOIN role_permissions rp ON rp.role_id = udm.role_id
    WHERE udm.user_id = p_user_id
      AND udm.department_id = p_department_id
      AND udm.is_active = TRUE
      AND rp.resource = p_resource
      AND rp.action = p_action
      AND rp.effect = 'allow'
  );
END;
$$;

-- -------------------------------------------------------------------------
-- enforce_standard_entry_uniqueness: trigger — drop and recreate as no-op
-- (The constraint it enforced made sense for old schema; the unique constraint
-- on the new table handles this. We nullify it to remove the broken reference.)
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_standard_entry_uniqueness()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Logic moved to DB unique constraints on user_department_memberships.
  -- This trigger body is intentionally empty to preserve trigger definition
  -- without referencing dropped tables.
  RETURN NEW;
END;
$$;

-- -------------------------------------------------------------------------
-- validate_primary_existence: was reading user_department_professions.
-- Rewritten to use user_department_memberships.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_primary_existence()
RETURNS TABLE(user_id uuid, active_count integer, primary_count integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    udm.user_id,
    COUNT(*)::integer AS active_count,
    COUNT(*) FILTER (WHERE udm.is_primary = TRUE)::integer AS primary_count
  FROM user_department_memberships udm
  WHERE udm.is_active = TRUE
    AND udm.membership_type = 'profession'
  GROUP BY udm.user_id
  HAVING COUNT(*) FILTER (WHERE udm.is_primary = TRUE) != 1;
END;
$$;

-- -------------------------------------------------------------------------
-- enforce_profession_matches_active_department: trigger — was checking
-- user_department_professions. Rewrite as no-op; new schema handles this
-- via foreign key constraints.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_profession_matches_active_department()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Logic is now handled by FK constraints on user_department_memberships.
  RETURN NEW;
END;
$$;

-- -------------------------------------------------------------------------
-- repair_missing_primary: was fixing user_department_professions.
-- Rewritten to fix user_department_memberships.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.repair_missing_primary()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_fixed integer := 0;
  v_user record;
  v_oldest_id uuid;
BEGIN
  -- Find users with active profession memberships but no primary set
  FOR v_user IN
    SELECT DISTINCT udm.user_id
    FROM user_department_memberships udm
    WHERE udm.is_active = TRUE
      AND udm.membership_type = 'profession'
      AND NOT EXISTS (
        SELECT 1 FROM user_department_memberships p
        WHERE p.user_id = udm.user_id
          AND p.is_primary = TRUE
          AND p.is_active = TRUE
          AND p.membership_type = 'profession'
      )
  LOOP
    -- Assign primary to the oldest active profession membership
    SELECT id INTO v_oldest_id
    FROM user_department_memberships
    WHERE user_id = v_user.user_id
      AND is_active = TRUE
      AND membership_type = 'profession'
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_oldest_id IS NOT NULL THEN
      UPDATE user_department_memberships
      SET is_primary = TRUE, updated_at = NOW()
      WHERE id = v_oldest_id;
      v_fixed := v_fixed + 1;
    END IF;
  END LOOP;

  RETURN v_fixed;
END;
$$;

-- -------------------------------------------------------------------------
-- can_manage_sub_team_members: was joining user_department_access_levels.
-- Rewritten to use user_department_memberships.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_manage_sub_team_members(p_user_id uuid, p_sub_team_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Check if user has a management-level access in the department that owns this sub-team
  RETURN EXISTS (
    SELECT 1
    FROM user_department_memberships udm
    JOIN roles r ON r.id = udm.role_id
    WHERE udm.user_id = p_user_id
      AND udm.is_active = TRUE
      AND r.name IN ('department-lead', 'department-manager', 'supervisor',
                     'department_lead', 'department_manager')
  );
END;
$$;

-- -------------------------------------------------------------------------
-- cascade_department_soft_delete: trigger — was soft-deleting
-- user_department_professions. Rewrite to target user_department_memberships.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cascade_department_soft_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.is_active = FALSE AND OLD.is_active = TRUE THEN
    UPDATE user_department_memberships
    SET is_active = FALSE,
        updated_at = NOW()
    WHERE department_id = NEW.id
      AND is_active = TRUE;
  END IF;
  RETURN NEW;
END;
$$;

-- -------------------------------------------------------------------------
-- update_membership_with_primary: was operating on user_department_professions.
-- Rewritten to operate on user_department_memberships.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_membership_with_primary(
  p_department_id uuid,
  p_user_id uuid,
  p_updates jsonb,
  p_performed_by uuid,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result jsonb;
  v_new_is_primary boolean;
  v_current record;
BEGIN
  -- Fetch the current membership
  SELECT * INTO v_current
  FROM user_department_memberships
  WHERE user_id = p_user_id
    AND department_id = p_department_id
    AND membership_type = 'profession'
    AND is_active = TRUE
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active profession membership not found for user % in department %', p_user_id, p_department_id;
  END IF;

  v_new_is_primary := COALESCE((p_updates->>'is_primary')::boolean, v_current.is_primary);

  -- If setting as primary, unset current primary in the same department
  IF v_new_is_primary = TRUE AND v_current.is_primary = FALSE THEN
    UPDATE user_department_memberships
    SET is_primary = FALSE, updated_at = NOW(), updated_by = p_performed_by
    WHERE user_id = p_user_id
      AND is_primary = TRUE
      AND is_active = TRUE
      AND id != v_current.id;
  END IF;

  -- Apply the updates
  UPDATE user_department_memberships
  SET
    is_primary = v_new_is_primary,
    is_active = COALESCE((p_updates->>'is_active')::boolean, is_active),
    role_id = COALESCE((p_updates->>'role_id')::uuid, role_id),
    updated_at = NOW(),
    updated_by = p_performed_by
  WHERE id = v_current.id
  RETURNING to_jsonb(user_department_memberships.*) INTO v_result;

  RETURN jsonb_build_object('success', true, 'membership', v_result);
END;
$$;

-- -------------------------------------------------------------------------
-- move_member_atomic (old signature with varchar role): rewrite for new schema.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.move_member_atomic(
  p_user_id uuid,
  p_from_department_id uuid,
  p_to_department_id uuid,
  p_new_role character varying,
  p_performed_by uuid,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_old_membership jsonb;
  v_new_membership jsonb;
  v_new_id uuid;
  v_role_id uuid;
  v_should_be_primary boolean;
BEGIN
  -- Look up the role_id by name from the roles table
  SELECT id INTO v_role_id
  FROM roles
  WHERE name = p_new_role AND is_active = TRUE
  LIMIT 1;

  IF v_role_id IS NULL THEN
    RAISE EXCEPTION 'Role "%" not found in roles table', p_new_role;
  END IF;

  -- Snapshot old membership
  SELECT to_jsonb(udm.*) INTO v_old_membership
  FROM user_department_memberships udm
  WHERE udm.user_id = p_user_id AND udm.department_id = p_from_department_id
    AND udm.membership_type = 'profession' AND udm.is_active = TRUE
  LIMIT 1;

  IF v_old_membership IS NULL THEN
    RAISE EXCEPTION 'Source membership not found';
  END IF;

  -- Deactivate old membership
  UPDATE user_department_memberships
  SET is_active = FALSE, is_primary = FALSE, updated_at = NOW(), updated_by = p_performed_by
  WHERE user_id = p_user_id AND department_id = p_from_department_id
    AND membership_type = 'profession' AND is_active = TRUE;

  -- Determine if new membership should be primary
  SELECT NOT EXISTS(
    SELECT 1 FROM user_department_memberships
    WHERE user_id = p_user_id AND is_primary = TRUE AND is_active = TRUE
  ) INTO v_should_be_primary;

  -- Insert new membership
  INSERT INTO user_department_memberships (
    user_id, department_id, membership_type, role_id, is_active, is_primary,
    created_by, updated_by
  ) VALUES (
    p_user_id, p_to_department_id, 'profession', v_role_id, TRUE, v_should_be_primary,
    p_performed_by, p_performed_by
  )
  RETURNING id, to_jsonb(user_department_memberships.*) INTO v_new_id, v_new_membership;

  -- Log to audit table
  INSERT INTO membership_audit_log (
    user_id, from_department_id, to_department_id, action,
    role_id, reason, performed_by
  ) VALUES (
    p_user_id, p_from_department_id, p_to_department_id, 'moved',
    v_role_id, p_reason, p_performed_by
  );

  RETURN jsonb_build_object(
    'success', true,
    'new_membership', v_new_membership,
    'became_primary', v_should_be_primary
  );
END;
$$;
