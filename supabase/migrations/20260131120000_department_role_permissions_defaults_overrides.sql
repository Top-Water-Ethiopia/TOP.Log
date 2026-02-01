BEGIN;

-- Add allow/deny semantics (override rules)
ALTER TABLE public.department_role_permissions
  ADD COLUMN IF NOT EXISTS effect TEXT NOT NULL DEFAULT 'allow';

-- Defaults are stored with department_id = NULL
ALTER TABLE public.department_role_permissions
  ALTER COLUMN department_id DROP NOT NULL;

-- Backfill existing rows (already defaulted, but ensure not null)
UPDATE public.department_role_permissions
SET effect = 'allow'
WHERE effect IS NULL;

-- Replace the old UNIQUE constraint so we can support NULL department_id.
-- NOTE: UNIQUE (department_id, ...) does not prevent duplicates when department_id is NULL.
ALTER TABLE public.department_role_permissions
  DROP CONSTRAINT IF EXISTS department_role_permissions_department_id_department_role_resource_action_key;

-- Enforce uniqueness for BOTH department-specific rows and defaults.
-- We coalesce NULL department_id to a stable UUID sentinel.
CREATE UNIQUE INDEX IF NOT EXISTS uq_department_role_permissions_dept_role_res_action
ON public.department_role_permissions (
  COALESCE(department_id, '00000000-0000-0000-0000-000000000000'::uuid),
  department_role,
  resource,
  action
);

-- RLS: Members can read permissions for their department, AND can read defaults.
DROP POLICY IF EXISTS "Members can view department role permissions" ON public.department_role_permissions;
CREATE POLICY "Members can view department role permissions"
  ON public.department_role_permissions
  FOR SELECT
  USING (
    public.is_admin()
    OR (
      department_id IS NULL
      AND EXISTS (
        SELECT 1
        FROM public.user_department_roles udr
        WHERE udr.user_id = auth.uid()
          AND udr.is_active = TRUE
      )
    )
    OR (
      department_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.user_department_roles udr
        WHERE udr.user_id = auth.uid()
          AND udr.department_id = department_role_permissions.department_id
          AND udr.is_active = TRUE
      )
    )
  );

COMMIT;
