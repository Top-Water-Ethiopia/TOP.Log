-- Migration: Separate Department Access Levels from Department Roles
-- This creates a clean separation between permissions (access levels) and question assignments (roles)

BEGIN;

-- Create department access levels table (for permissions)
CREATE TABLE IF NOT EXISTS public.department_access_levels (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  name text NOT NULL,
  display_name text NOT NULL,
  description text,
  level integer NOT NULL, -- Higher number = more permissions
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT department_access_levels_pkey PRIMARY KEY (id),
  CONSTRAINT department_access_levels_name_unique UNIQUE (name)
);

-- Create access level permissions table
CREATE TABLE IF NOT EXISTS public.department_access_level_permissions (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  access_level_id uuid NOT NULL,
  resource text NOT NULL,
  action text NOT NULL,
  effect text NOT NULL DEFAULT 'allow',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT department_access_level_permissions_pkey PRIMARY KEY (id),
  CONSTRAINT department_access_level_permissions_access_level_id_fkey FOREIGN KEY (access_level_id) REFERENCES public.department_access_levels(id) ON DELETE CASCADE,
  CONSTRAINT department_access_level_permissions_unique UNIQUE (access_level_id, resource, action)
);

-- Update department_roles table to add description field (keep for questions only)
ALTER TABLE public.department_roles 
ADD COLUMN IF NOT EXISTS description text;

-- Create user department access levels table (for permissions)
CREATE TABLE IF NOT EXISTS public.user_department_access_levels (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  user_id uuid NOT NULL,
  department_id uuid NOT NULL,
  access_level_id uuid NOT NULL,
  assigned_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_department_access_levels_pkey PRIMARY KEY (id),
  CONSTRAINT user_department_access_levels_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT user_department_access_levels_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE CASCADE,
  CONSTRAINT user_department_access_levels_access_level_id_fkey FOREIGN KEY (access_level_id) REFERENCES public.department_access_levels(id) ON DELETE CASCADE,
  CONSTRAINT user_department_access_levels_user_dept_unique UNIQUE (user_id, department_id)
);

-- Insert default department access levels
INSERT INTO public.department_access_levels (name, display_name, description, level) VALUES
  ('viewer', 'Viewer', 'Can view entries and basic analytics', 1),
  ('contributor', 'Contributor', 'Can create and edit own entries', 2),
  ('supervisor', 'Supervisor', 'Can manage team entries and view reports', 3),
  ('department-manager', 'Department Manager', 'Can manage department settings and team members', 4),
  ('department-lead', 'Department Lead', 'Full department control and analytics access', 5)
ON CONFLICT (name) DO NOTHING;

-- Get the access level IDs for permission assignment
DO $$
DECLARE
  viewer_id uuid;
  contributor_id uuid;
  supervisor_id uuid;
  manager_id uuid;
  lead_id uuid;
BEGIN
  SELECT id INTO viewer_id FROM public.department_access_levels WHERE name = 'viewer';
  SELECT id INTO contributor_id FROM public.department_access_levels WHERE name = 'contributor';
  SELECT id INTO supervisor_id FROM public.department_access_levels WHERE name = 'supervisor';
  SELECT id INTO manager_id FROM public.department_access_levels WHERE name = 'department-manager';
  SELECT id INTO lead_id FROM public.department_access_levels WHERE name = 'department-lead';

  -- Insert permissions for each access level
  
  -- Viewer permissions
  INSERT INTO public.department_access_level_permissions (access_level_id, resource, action) VALUES
    (viewer_id, 'entries', 'read'),
    (viewer_id, 'entries', 'export.own'),
    (viewer_id, 'analytics', 'read.own')
  ON CONFLICT (access_level_id, resource, action) DO NOTHING;

  -- Contributor permissions
  INSERT INTO public.department_access_level_permissions (access_level_id, resource, action) VALUES
    (contributor_id, 'entries', 'create'),
    (contributor_id, 'entries', 'read'),
    (contributor_id, 'entries', 'update.own'),
    (contributor_id, 'entries', 'delete.own'),
    (contributor_id, 'entries', 'export.own'),
    (contributor_id, 'analytics', 'read.own')
  ON CONFLICT (access_level_id, resource, action) DO NOTHING;

  -- Supervisor permissions
  INSERT INTO public.department_access_level_permissions (access_level_id, resource, action) VALUES
    (supervisor_id, 'entries', 'create'),
    (supervisor_id, 'entries', 'read'),
    (supervisor_id, 'entries', 'update'),
    (supervisor_id, 'entries', 'delete'),
    (supervisor_id, 'entries', 'export'),
    (supervisor_id, 'analytics', 'read'),
    (supervisor_id, 'analytics', 'team')
  ON CONFLICT (access_level_id, resource, action) DO NOTHING;

  -- Department Manager permissions
  INSERT INTO public.department_access_level_permissions (access_level_id, resource, action) VALUES
    (manager_id, 'entries', 'create'),
    (manager_id, 'entries', 'read'),
    (manager_id, 'entries', 'update'),
    (manager_id, 'entries', 'delete'),
    (manager_id, 'entries', 'export'),
    (manager_id, 'analytics', 'read'),
    (manager_id, 'analytics', 'team'),
    (manager_id, 'departments', 'members.read'),
    (manager_id, 'departments', 'members.manage')
  ON CONFLICT (access_level_id, resource, action) DO NOTHING;

  -- Department Lead permissions
  INSERT INTO public.department_access_level_permissions (access_level_id, resource, action) VALUES
    (lead_id, 'entries', 'create'),
    (lead_id, 'entries', 'read'),
    (lead_id, 'entries', 'update'),
    (lead_id, 'entries', 'delete'),
    (lead_id, 'entries', 'export'),
    (lead_id, 'analytics', 'read'),
    (lead_id, 'analytics', 'team'),
    (lead_id, 'analytics', 'advanced'),
    (lead_id, 'departments', 'members.read'),
    (lead_id, 'departments', 'members.manage'),
    (lead_id, 'departments', 'update')
  ON CONFLICT (access_level_id, resource, action) DO NOTHING;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_department_access_levels_name ON public.department_access_levels USING btree (name);
CREATE INDEX IF NOT EXISTS idx_department_access_level_permissions_access_level ON public.department_access_level_permissions USING btree (access_level_id);
CREATE INDEX IF NOT EXISTS idx_user_department_access_levels_user ON public.user_department_access_levels USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_user_department_access_levels_department ON public.user_department_access_levels USING btree (department_id);
CREATE INDEX IF NOT EXISTS idx_user_department_access_levels_access_level ON public.user_department_access_levels USING btree (access_level_id);

-- Create triggers for updated_at
CREATE TRIGGER update_department_access_levels_timestamp BEFORE
UPDATE ON public.department_access_levels FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_department_access_level_permissions_timestamp BEFORE
UPDATE ON public.department_access_level_permissions FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_user_department_access_levels_timestamp BEFORE
UPDATE ON public.user_department_access_levels FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- Migrate existing data: Assign default access level to existing users
-- Since we don't have role_id in user_department_roles, we'll assign everyone as 'contributor' by default
DO $$
DECLARE
  existing_user RECORD;
  contributor_access_level_id uuid;
BEGIN
  SELECT id INTO contributor_access_level_id FROM public.department_access_levels WHERE name = 'contributor';
  
  -- For each existing user_department_roles
  FOR existing_user IN 
    SELECT udr.user_id, udr.department_id, udr.created_by
    FROM public.user_department_roles udr
    WHERE udr.is_active = true
  LOOP
    -- Insert into new access level assignment table as contributor by default
    INSERT INTO public.user_department_access_levels (
      user_id, department_id, access_level_id, assigned_by
    ) VALUES (
      existing_user.user_id, 
      existing_user.department_id, 
      contributor_access_level_id,
      existing_user.created_by
    ) ON CONFLICT (user_id, department_id) DO NOTHING;
  END LOOP;
END $$;

-- Note: We keep department_role_permissions table for now since it might be used elsewhere
-- It can be dropped later after confirming the new system works

COMMIT;
