-- Add audit fields to user_department_roles

ALTER TABLE IF EXISTS public.user_department_roles
  ADD COLUMN IF NOT EXISTS created_by UUID NULL REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS updated_by UUID NULL REFERENCES auth.users(id);
