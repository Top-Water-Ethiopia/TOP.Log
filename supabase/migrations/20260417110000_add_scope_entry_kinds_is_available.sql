-- Add is_available flag to scope_entry_kinds for submitter-side suspension
-- This is intentionally separate from is_active:
-- - is_active: structural/admin enablement and default validation
-- - is_available: whether submitters can see/select/submit this entry kind

BEGIN;

ALTER TABLE public.scope_entry_kinds
ADD COLUMN IF NOT EXISTS is_available BOOLEAN NOT NULL DEFAULT TRUE;

-- Indexes to support availability lookups (endpoints + insert trigger)
CREATE INDEX IF NOT EXISTS idx_scope_entry_kinds_dept_availability
  ON public.scope_entry_kinds (department_id, scope_type, entry_kind, is_active, is_available)
  WHERE department_profession_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_scope_entry_kinds_prof_availability
  ON public.scope_entry_kinds (department_id, scope_type, profession_role_id, entry_kind, is_active, is_available);

COMMIT;

