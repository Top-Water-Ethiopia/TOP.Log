-- Migration: Ensure global admin/system-admin/super-admin roles have admin.system and related permissions
-- Some environments may have legacy role UUIDs (not the fixed 0000... ids).
-- This migration syncs permissions by role name to prevent admin lockout.

BEGIN;

DO $$
DECLARE
  v_role RECORD;
  v_perm RECORD;
BEGIN
  -- Target role names (legacy + current)
  FOR v_role IN
    SELECT id
    FROM public.roles
    WHERE department_id IS NULL
      AND lower(name) IN ('admin', 'system-admin', 'super-admin')
  LOOP
    -- Sync the same baseline set as 20260413000011_seed_global_admin_permissions.sql
    FOR v_perm IN
      SELECT *
      FROM (
        VALUES
          ('entries','create'),
          ('entries','read'),
          ('entries','update'),
          ('entries','delete'),
          ('entries','export'),
          ('entries','import'),
          ('users','create'),
          ('users','read'),
          ('users','update'),
          ('users','delete'),
          ('users','manage'),
          ('departments','create'),
          ('departments','read'),
          ('departments','update'),
          ('departments','delete'),
          ('departments','members.read'),
          ('departments','members.manage'),
          ('analytics','read'),
          ('analytics','read.own'),
          ('analytics','advanced'),
          ('analytics','team'),
          ('admin','system'),
          ('admin','audit'),
          ('admin','backup'),
          ('admin','restore'),
          ('admin','settings'),
          ('department_questions','answer'),
          ('department_questions','read')
      ) AS t(resource, action)
    LOOP
      INSERT INTO public.role_permissions (role_id, resource, action, effect)
      VALUES (v_role.id, v_perm.resource, v_perm.action, 'allow')
      ON CONFLICT (role_id, resource, action) DO UPDATE
        SET effect = EXCLUDED.effect;
    END LOOP;
  END LOOP;
END $$;

COMMIT;

