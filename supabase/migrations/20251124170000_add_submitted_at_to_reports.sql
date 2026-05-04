-- Add submitted_at column to public.reports without recreating the table
-- This keeps existing data, constraints, and RLS policies intact.

BEGIN;

-- Ensure reports table exists (it already does in this project, but keep this defensive)
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Add submitted_at column if it does not already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'reports'
      AND column_name  = 'submitted_at'
  ) THEN
    ALTER TABLE public.reports
      ADD COLUMN submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;
END $$;

COMMIT;
