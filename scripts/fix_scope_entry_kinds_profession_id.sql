-- Fix for scope_entry_kinds.department_profession_id type mismatch
-- This changes the column from UUID to TEXT to match department_professions.key
-- 
-- Apply this in Supabase SQL Editor or run via supabase db reset

BEGIN;

-- 1. Drop the foreign key constraint (it references a non-existent UUID column)
ALTER TABLE public.scope_entry_kinds
  DROP CONSTRAINT IF EXISTS scope_entry_kinds_department_profession_id_fkey;

-- 2. Drop the UUID column and recreate as TEXT
ALTER TABLE public.scope_entry_kinds
  DROP COLUMN IF EXISTS department_profession_id;

-- 3. Add the column as TEXT (matching department_professions.key)
ALTER TABLE public.scope_entry_kinds
  ADD COLUMN department_profession_id TEXT NULL;

-- 4. Add a comment explaining the relationship
COMMENT ON COLUMN public.scope_entry_kinds.department_profession_id IS 
  'References department_professions.key (TEXT PK) or NULL for department-wide scope';

-- 5. Recreate the partial unique indexes with the TEXT column
DROP INDEX IF EXISTS idx_scope_entry_kinds_prof_row_unique;
CREATE UNIQUE INDEX idx_scope_entry_kinds_prof_row_unique
  ON public.scope_entry_kinds(department_profession_id, entry_kind)
  WHERE department_profession_id IS NOT NULL;

DROP INDEX IF EXISTS idx_scope_entry_kinds_prof_default;
CREATE UNIQUE INDEX idx_scope_entry_kinds_prof_default
  ON public.scope_entry_kinds(department_profession_id)
  WHERE department_profession_id IS NOT NULL AND is_default = true;

-- 6. Recreate the lookup index
DROP INDEX IF EXISTS idx_scope_entry_kinds_lookup;
CREATE INDEX idx_scope_entry_kinds_lookup
  ON public.scope_entry_kinds(department_id, department_profession_id, is_active);

COMMIT;
