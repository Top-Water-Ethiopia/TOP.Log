BEGIN;

ALTER TABLE public.departments
ADD COLUMN IF NOT EXISTS slug text;

-- Backfill existing marketing department (best-effort; safe if none exists)
UPDATE public.departments
SET slug = 'marketing'
WHERE slug IS NULL
  AND lower(name) LIKE '%marketing%';

-- Normalize any provided slug to lowercase
UPDATE public.departments
SET slug = lower(slug)
WHERE slug IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'departments_slug_lowercase_check'
      AND conrelid = 'public.departments'::regclass
  ) THEN
    ALTER TABLE public.departments
    ADD CONSTRAINT departments_slug_lowercase_check
    CHECK (slug IS NULL OR slug = lower(slug));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'departments_slug_format_check'
      AND conrelid = 'public.departments'::regclass
  ) THEN
    ALTER TABLE public.departments
    ADD CONSTRAINT departments_slug_format_check
    CHECK (slug IS NULL OR (slug ~ '^[a-z0-9_]+$' AND length(slug) <= 50));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS departments_slug_unique_lower
ON public.departments (lower(slug))
WHERE slug IS NOT NULL;

COMMIT;
