BEGIN;

-- Ensure UUID generator exists (matches existing seed migration style)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Add department question permissions to the catalog
INSERT INTO public.permission_definitions (resource, action, description)
VALUES
  ('department_questions', 'read', 'View department-scoped questions'),
  ('department_questions', 'answer', 'Answer department-scoped questions in reports')
ON CONFLICT (resource, action) DO NOTHING;

-- Ensure admin/system-admin/super-admin roles get these new permissions too
DO $$
DECLARE
  v_role_id UUID;
  v_role_name TEXT;
BEGIN
  FOREACH v_role_name IN ARRAY ARRAY['admin', 'system-admin', 'super-admin']
  LOOP
    SELECT r.id
      INTO v_role_id
      FROM public.roles r
     WHERE r.name = v_role_name
     LIMIT 1;

    IF v_role_id IS NOT NULL THEN
      INSERT INTO public.permissions (id, role_id, resource, action)
      SELECT
        uuid_generate_v4(),
        v_role_id,
        pd.resource,
        pd.action
      FROM public.permission_definitions pd
      WHERE pd.resource = 'department_questions'
        AND pd.action IN ('read', 'answer')
      ON CONFLICT (role_id, resource, action) DO NOTHING;
    END IF;
  END LOOP;
END;
$$;

COMMIT;
