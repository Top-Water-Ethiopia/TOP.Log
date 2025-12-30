-- Migration: Drop departments.code column
-- The application no longer uses department codes.

ALTER TABLE public.departments
  DROP COLUMN IF EXISTS code;
