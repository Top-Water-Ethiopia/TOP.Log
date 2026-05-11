BEGIN;

-- Define semantic permission for department-level aggregation
INSERT INTO public.permission_definitions (resource, action, description, scope)
VALUES ('entries', 'aggregate_department', 'Aggregate/metric access for department entries', 'department')
ON CONFLICT (resource, action) DO NOTHING;

-- Best-effort: grant ONLY to department-lead role if present (adjust via admin UI later)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.roles WHERE name = 'department-lead') THEN
    INSERT INTO public.role_permissions (role_id, resource, action, effect)
    SELECT id, 'entries', 'aggregate_department', 'allow'
    FROM public.roles
    WHERE name = 'department-lead'
    ON CONFLICT (role_id, resource, action) DO NOTHING;
  END IF;

  -- Some deployments use underscore naming
  IF EXISTS (SELECT 1 FROM public.roles WHERE name = 'department_lead') THEN
    INSERT INTO public.role_permissions (role_id, resource, action, effect)
    SELECT id, 'entries', 'aggregate_department', 'allow'
    FROM public.roles
    WHERE name = 'department_lead'
    ON CONFLICT (role_id, resource, action) DO NOTHING;
  END IF;
END $$;

COMMIT;
