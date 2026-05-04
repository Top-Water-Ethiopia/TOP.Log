BEGIN;

-- Add department_id and description columns to department_roles table
ALTER TABLE IF EXISTS public.department_roles
  ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.department_roles
  ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE IF EXISTS public.department_roles
  ADD COLUMN IF NOT EXISTS level INT NOT NULL DEFAULT 1;

-- Helpful indexes for querying roles by department.
CREATE INDEX IF NOT EXISTS idx_department_roles_department_id
  ON public.department_roles (department_id);

CREATE INDEX IF NOT EXISTS idx_department_roles_department_id_sort_order
  ON public.department_roles (department_id, sort_order);

COMMIT;
