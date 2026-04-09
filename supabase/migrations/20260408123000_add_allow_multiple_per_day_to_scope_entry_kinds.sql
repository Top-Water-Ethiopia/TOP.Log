ALTER TABLE public.scope_entry_kinds
  ADD COLUMN IF NOT EXISTS allow_multiple_per_day boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.scope_entry_kinds.allow_multiple_per_day IS
  'When true, this entry kind may be submitted multiple times on the same date within the configured scope.';
