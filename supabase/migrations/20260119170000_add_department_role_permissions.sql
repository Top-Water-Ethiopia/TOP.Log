BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.department_role_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  department_role TEXT NOT NULL,
  resource TEXT NOT NULL,
  action TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (department_id, department_role, resource, action)
);

 CREATE UNIQUE INDEX IF NOT EXISTS uq_department_role_permissions_dept_role_res_action
   ON public.department_role_permissions (
     COALESCE(department_id, '00000000-0000-0000-0000-000000000000'::uuid),
     department_role,
     resource,
     action
   );

CREATE INDEX IF NOT EXISTS idx_department_role_permissions_dept ON public.department_role_permissions(department_id);
CREATE INDEX IF NOT EXISTS idx_department_role_permissions_role ON public.department_role_permissions(department_role);

ALTER TABLE public.department_role_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view department role permissions" ON public.department_role_permissions;
CREATE POLICY "Members can view department role permissions"
  ON public.department_role_permissions
  FOR SELECT
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.user_department_roles udr
      WHERE udr.user_id = auth.uid()
        AND udr.department_id = department_role_permissions.department_id
        AND udr.is_active = TRUE
    )
  );

INSERT INTO public.department_role_permissions (id, department_id, department_role, resource, action)
SELECT
  uuid_generate_v4(),
  d.id,
  'department_lead',
  'department_questions',
  'answer'
FROM public.departments d
 ON CONFLICT (
   COALESCE(department_id, '00000000-0000-0000-0000-000000000000'::uuid),
   department_role,
   resource,
   action
 ) DO NOTHING;

COMMIT;
