BEGIN;

-- Define semantic permissions for marketing team directory
INSERT INTO public.permission_definitions (resource, action, description, scope)
VALUES
  ('marketing', 'team.read', 'View marketing department team directory', 'department'),
  ('marketing', 'team.contact.read', 'View phone numbers in marketing team directory', 'department')
ON CONFLICT (resource, action) DO NOTHING;

-- Grant marketing.team.read to department-lead and department-manager roles
DO $$
BEGIN
  -- department-lead (hyphen)
  IF EXISTS (SELECT 1 FROM public.roles WHERE name = 'department-lead') THEN
    INSERT INTO public.role_permissions (role_id, resource, action, effect)
    SELECT id, 'marketing', 'team.read', 'allow'
    FROM public.roles
    WHERE name = 'department-lead'
    ON CONFLICT (role_id, resource, action) DO NOTHING;

    INSERT INTO public.role_permissions (role_id, resource, action, effect)
    SELECT id, 'marketing', 'team.contact.read', 'allow'
    FROM public.roles
    WHERE name = 'department-lead'
    ON CONFLICT (role_id, resource, action) DO NOTHING;
  END IF;

  -- department_lead (underscore)
  IF EXISTS (SELECT 1 FROM public.roles WHERE name = 'department_lead') THEN
    INSERT INTO public.role_permissions (role_id, resource, action, effect)
    SELECT id, 'marketing', 'team.read', 'allow'
    FROM public.roles
    WHERE name = 'department_lead'
    ON CONFLICT (role_id, resource, action) DO NOTHING;

    INSERT INTO public.role_permissions (role_id, resource, action, effect)
    SELECT id, 'marketing', 'team.contact.read', 'allow'
    FROM public.roles
    WHERE name = 'department_lead'
    ON CONFLICT (role_id, resource, action) DO NOTHING;
  END IF;

  -- department-manager (hyphen)
  IF EXISTS (SELECT 1 FROM public.roles WHERE name = 'department-manager') THEN
    INSERT INTO public.role_permissions (role_id, resource, action, effect)
    SELECT id, 'marketing', 'team.read', 'allow'
    FROM public.roles
    WHERE name = 'department-manager'
    ON CONFLICT (role_id, resource, action) DO NOTHING;

    INSERT INTO public.role_permissions (role_id, resource, action, effect)
    SELECT id, 'marketing', 'team.contact.read', 'allow'
    FROM public.roles
    WHERE name = 'department-manager'
    ON CONFLICT (role_id, resource, action) DO NOTHING;
  END IF;

  -- department_manager (underscore)
  IF EXISTS (SELECT 1 FROM public.roles WHERE name = 'department_manager') THEN
    INSERT INTO public.role_permissions (role_id, resource, action, effect)
    SELECT id, 'marketing', 'team.read', 'allow'
    FROM public.roles
    WHERE name = 'department_manager'
    ON CONFLICT (role_id, resource, action) DO NOTHING;

    INSERT INTO public.role_permissions (role_id, resource, action, effect)
    SELECT id, 'marketing', 'team.contact.read', 'allow'
    FROM public.roles
    WHERE name = 'department_manager'
    ON CONFLICT (role_id, resource, action) DO NOTHING;
  END IF;
END $$;

-- Also grant to global admin roles (super-admin, admin, system-admin)
DO $$
BEGIN
  -- super-admin
  IF EXISTS (SELECT 1 FROM public.roles WHERE id = '00000000-0000-0000-0000-000000000000') THEN
    INSERT INTO public.role_permissions (role_id, resource, action, effect)
    VALUES
      ('00000000-0000-0000-0000-000000000000', 'marketing', 'team.read', 'allow'),
      ('00000000-0000-0000-0000-000000000000', 'marketing', 'team.contact.read', 'allow')
    ON CONFLICT (role_id, resource, action) DO NOTHING;
  END IF;

  -- admin
  IF EXISTS (SELECT 1 FROM public.roles WHERE id = '00000000-0000-0000-0000-000000000001') THEN
    INSERT INTO public.role_permissions (role_id, resource, action, effect)
    VALUES
      ('00000000-0000-0000-0000-000000000001', 'marketing', 'team.read', 'allow'),
      ('00000000-0000-0000-0000-000000000001', 'marketing', 'team.contact.read', 'allow')
    ON CONFLICT (role_id, resource, action) DO NOTHING;
  END IF;

  -- system-admin
  IF EXISTS (SELECT 1 FROM public.roles WHERE id = '00000000-0000-0000-0000-000000000010') THEN
    INSERT INTO public.role_permissions (role_id, resource, action, effect)
    VALUES
      ('00000000-0000-0000-0000-000000000010', 'marketing', 'team.read', 'allow'),
      ('00000000-0000-0000-0000-000000000010', 'marketing', 'team.contact.read', 'allow')
    ON CONFLICT (role_id, resource, action) DO NOTHING;
  END IF;
END $$;

COMMIT;
