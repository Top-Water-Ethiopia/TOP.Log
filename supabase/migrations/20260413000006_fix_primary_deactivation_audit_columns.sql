CREATE OR REPLACE FUNCTION handle_primary_deactivation()
RETURNS TRIGGER AS $$
DECLARE
  v_fallback_id UUID;
BEGIN
  IF OLD.is_primary = TRUE AND NEW.is_active = FALSE THEN
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

      INSERT INTO membership_audit_log (
        user_id,
        membership_type,
        role_id,
        action,
        reason,
        performed_by
      ) VALUES (
        NEW.user_id,
        NEW.membership_type,
        NEW.role_id,
        'primary_auto_promoted',
        'Previous primary was deactivated',
        COALESCE(NEW.updated_by, auth.uid())
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
