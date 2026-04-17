-- Add optional date window restriction for submitter availability.
-- Evaluated against the report's selected date (captain_log_entries.date).
-- Inclusive bounds: start <= report_date <= end.

BEGIN;

ALTER TABLE public.scope_entry_kinds
ADD COLUMN IF NOT EXISTS available_start_date DATE NULL;

ALTER TABLE public.scope_entry_kinds
ADD COLUMN IF NOT EXISTS available_end_date DATE NULL;

-- Ensure start <= end when both are present (Postgres lacks ADD CONSTRAINT IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'scope_entry_kinds_available_window_valid'
      AND conrelid = 'public.scope_entry_kinds'::regclass
  ) THEN
    ALTER TABLE public.scope_entry_kinds
      ADD CONSTRAINT scope_entry_kinds_available_window_valid
      CHECK (
        available_start_date IS NULL
        OR available_end_date IS NULL
        OR available_start_date <= available_end_date
      );
  END IF;
END $$;

COMMIT;

