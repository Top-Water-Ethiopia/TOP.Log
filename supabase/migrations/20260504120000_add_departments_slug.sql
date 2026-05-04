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

ALTER TABLE public.departments
ADD CONSTRAINT IF NOT EXISTS departments_slug_lowercase_check
CHECK (slug IS NULL OR slug = lower(slug));

ALTER TABLE public.departments
ADD CONSTRAINT IF NOT EXISTS departments_slug_format_check
CHECK (slug IS NULL OR (slug ~ '^[a-z0-9_]+$' AND length(slug) <= 50));

CREATE UNIQUE INDEX IF NOT EXISTS departments_slug_unique_lower
ON public.departments (lower(slug))
WHERE slug IS NOT NULL;

COMMIT;

