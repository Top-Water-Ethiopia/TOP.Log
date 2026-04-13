-- Phase 1: Scope Entry Kinds - add explicit scope_type and support department-report entry kinds
-- Non-breaking: keeps legacy department_profession_id for dual-read/dual-write rollout.

BEGIN;

-- 1) Enum type for entry kind configuration scope
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'entry_kind_scope_type_enum') THEN
    CREATE TYPE entry_kind_scope_type_enum AS ENUM ('dept_wide_personal', 'profession_personal', 'dept_report');
  END IF;
END$$;

-- 2) Add new columns (additive only)
ALTER TABLE public.scope_entry_kinds
  ADD COLUMN IF NOT EXISTS scope_type entry_kind_scope_type_enum NOT NULL DEFAULT 'dept_wide_personal',
  ADD COLUMN IF NOT EXISTS profession_role_id UUID NULL REFERENCES public.roles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.scope_entry_kinds.scope_type IS
  'Separates Personal logging entry kinds (dept-wide + profession override) from Department Report entry kinds.';
COMMENT ON COLUMN public.scope_entry_kinds.profession_role_id IS
  'References roles.id for department-scoped profession roles. Used only when scope_type=profession_personal.';

-- 3) Backfill scope_type for existing rows based on legacy department_profession_id
UPDATE public.scope_entry_kinds
SET scope_type = CASE
  WHEN department_profession_id IS NULL THEN 'dept_wide_personal'::entry_kind_scope_type_enum
  ELSE 'profession_personal'::entry_kind_scope_type_enum
END
WHERE scope_type IS NULL OR scope_type = 'dept_wide_personal'::entry_kind_scope_type_enum;

-- 4) Rework indexes to allow dept_report alongside dept_wide_personal in the same department
-- Drop legacy department-level uniqueness/default indexes (they would block dept_report defaults).
DROP INDEX IF EXISTS idx_scope_entry_kinds_dept_row_unique;
DROP INDEX IF EXISTS idx_scope_entry_kinds_dept_default;

-- Department-wide personal: unique row per (department_id, entry_kind)
CREATE UNIQUE INDEX IF NOT EXISTS idx_scope_entry_kinds_dept_wide_personal_row_unique
  ON public.scope_entry_kinds(department_id, entry_kind)
  WHERE scope_type = 'dept_wide_personal' AND department_profession_id IS NULL;

-- Department report: unique row per (department_id, entry_kind)
CREATE UNIQUE INDEX IF NOT EXISTS idx_scope_entry_kinds_dept_report_row_unique
  ON public.scope_entry_kinds(department_id, entry_kind)
  WHERE scope_type = 'dept_report' AND department_profession_id IS NULL;

-- Default uniqueness per target
CREATE UNIQUE INDEX IF NOT EXISTS idx_scope_entry_kinds_dept_wide_personal_default
  ON public.scope_entry_kinds(department_id)
  WHERE scope_type = 'dept_wide_personal' AND department_profession_id IS NULL AND is_default = true;

CREATE UNIQUE INDEX IF NOT EXISTS idx_scope_entry_kinds_dept_report_default
  ON public.scope_entry_kinds(department_id)
  WHERE scope_type = 'dept_report' AND department_profession_id IS NULL AND is_default = true;

-- Profession personal (new): unique per profession_role_id when present
CREATE UNIQUE INDEX IF NOT EXISTS idx_scope_entry_kinds_prof_role_row_unique
  ON public.scope_entry_kinds(profession_role_id, entry_kind)
  WHERE scope_type = 'profession_personal' AND profession_role_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_scope_entry_kinds_prof_role_default
  ON public.scope_entry_kinds(profession_role_id)
  WHERE scope_type = 'profession_personal' AND profession_role_id IS NOT NULL AND is_default = true;

-- Keep existing legacy profession uniqueness/default indexes on department_profession_id for dual-read phase.

-- 5) Seed department_reports.submit permission for global admin roles (Phase 1)
-- We use role_permissions directly (permission_definitions is managed via admin UI; this ensures enforcement works).
CREATE OR REPLACE FUNCTION public.sync_role_permission(p_role_id UUID, p_resource TEXT, p_action TEXT)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.role_permissions (role_id, resource, action, effect)
    VALUES (p_role_id, p_resource, p_action, 'allow')
    ON CONFLICT (role_id, resource, action) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Super-Admin, Admin, System-Admin
SELECT sync_role_permission('00000000-0000-0000-0000-000000000000', 'department_reports', 'submit');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000001', 'department_reports', 'submit');
SELECT sync_role_permission('00000000-0000-0000-0000-000000000010', 'department_reports', 'submit');

DROP FUNCTION sync_role_permission(UUID, TEXT, TEXT);

COMMIT;

