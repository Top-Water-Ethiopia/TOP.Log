-- Migration: Remove CHECK constraint on captain_log_entries to allow custom entry kinds
-- Phase 2: Custom Entry Kind Keys by Scope

-- Remove the old CHECK constraint that limited to 3 hardcoded values
-- Now we use scope_entry_kinds table for validation
ALTER TABLE public.captain_log_entries
DROP CONSTRAINT IF EXISTS captain_log_entries_entry_kind_check;

-- Add a new CHECK constraint that enforces lowercase format only
-- Keys must be lowercase alphanumeric with underscores, 1-50 chars
-- This aligns with the constraint on scope_entry_kinds
ALTER TABLE public.captain_log_entries
ADD CONSTRAINT captain_log_entries_entry_kind_format CHECK (
  entry_kind ~ '^[a-z0-9_]+$' AND length(entry_kind) <= 50
);

COMMENT ON CONSTRAINT captain_log_entries_entry_kind_format ON public.captain_log_entries IS 
  'Enforces lowercase alphanumeric + underscore format (1-50 chars) matching scope_entry_kinds';
