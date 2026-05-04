-- Add is_active column to user_department_access_levels table
-- This column was missing from the original table creation

BEGIN;

ALTER TABLE public.user_department_access_levels
ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

COMMIT;
