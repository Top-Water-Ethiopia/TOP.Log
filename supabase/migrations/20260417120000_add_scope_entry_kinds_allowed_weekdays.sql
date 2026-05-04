-- Add optional weekday restriction for submitter availability.
-- ISO weekday values: 1=Mon ... 7=Sun.
-- NULL (or empty array) means "no weekday restriction".

BEGIN;

ALTER TABLE public.scope_entry_kinds
ADD COLUMN IF NOT EXISTS allowed_weekdays SMALLINT[] NULL;

-- Ensure values are within 1..7 when provided
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'scope_entry_kinds_allowed_weekdays_valid'
      AND conrelid = 'public.scope_entry_kinds'::regclass
  ) THEN
    ALTER TABLE public.scope_entry_kinds
      ADD CONSTRAINT scope_entry_kinds_allowed_weekdays_valid
      CHECK (
        allowed_weekdays IS NULL
        OR allowed_weekdays <@ ARRAY[1,2,3,4,5,6,7]::SMALLINT[]
      );
  END IF;
END $$;

COMMIT;
