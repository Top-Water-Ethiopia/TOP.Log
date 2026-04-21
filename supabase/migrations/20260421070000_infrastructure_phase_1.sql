-- Migration: Infrastructure Phase 1: Hardened DB Core
-- Description: Add snapshot tables, versioning fields, and immutability triggers.

BEGIN;

-- 1. Create entry_kind_versions table
CREATE TABLE IF NOT EXISTS public.entry_kind_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    scope_entry_kind_id uuid NOT NULL REFERENCES public.scope_entry_kinds(id) ON DELETE CASCADE,
    version integer NOT NULL,
    ui_schema jsonb NOT NULL, -- Full snapshot of the UI configuration
    render_schema_version integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES auth.users(id),
    UNIQUE(scope_entry_kind_id, version)
);

-- 2. Create question_set_versions table
CREATE TABLE IF NOT EXISTS public.question_set_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_kind_version_id uuid NOT NULL REFERENCES public.entry_kind_versions(id) ON DELETE CASCADE,
    questions jsonb NOT NULL, -- Snapshot of the question set
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES auth.users(id)
);

-- 3. Alter scope_entry_kinds to add governance and capability fields
ALTER TABLE public.scope_entry_kinds 
ADD COLUMN IF NOT EXISTS has_profession_sections boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS has_department_sections boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deprecated'));

-- Add constraint: at least one axis must be true (Phase 5 will make this NOT NULL)
-- For now, we allow them to be false to avoid breaking existing data before backfill.

-- 4. Alter captain_log_entries to add versioning and date fields
ALTER TABLE public.captain_log_entries
ADD COLUMN IF NOT EXISTS entry_kind_version_id uuid REFERENCES public.entry_kind_versions(id),
ADD COLUMN IF NOT EXISTS question_set_version_id uuid REFERENCES public.question_set_versions(id),
ADD COLUMN IF NOT EXISTS submitted_for_date date;

-- 5. Implement prevent_slug_update trigger on scope_entry_kinds
-- Based on the existing table, 'entry_kind' is the slug.
CREATE OR REPLACE FUNCTION public.prevent_entry_kind_slug_update()
RETURNS trigger AS $$
BEGIN
  IF NEW.entry_kind <> OLD.entry_kind THEN
    RAISE EXCEPTION 'Entry kind slug (entry_kind) is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_entry_kind_slug_update ON public.scope_entry_kinds;
CREATE TRIGGER trg_prevent_entry_kind_slug_update
BEFORE UPDATE ON public.scope_entry_kinds
FOR EACH ROW EXECUTE FUNCTION public.prevent_entry_kind_slug_update();

COMMIT;
