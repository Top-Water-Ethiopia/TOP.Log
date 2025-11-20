-- Migration: Drop department_questions table
-- This table is no longer needed as department questions feature has been removed

BEGIN;

-- Drop the trigger first
DROP TRIGGER IF EXISTS update_department_questions_timestamp ON department_questions;

-- Drop RLS policies
DROP POLICY IF EXISTS "Users can view questions for their department" ON department_questions;
DROP POLICY IF EXISTS "Admins can create department questions" ON department_questions;
DROP POLICY IF EXISTS "Admins can update department questions" ON department_questions;
DROP POLICY IF EXISTS "Admins can delete department questions" ON department_questions;

-- Drop indexes
DROP INDEX IF EXISTS idx_department_questions_department;
DROP INDEX IF EXISTS idx_department_questions_active;
DROP INDEX IF EXISTS idx_department_questions_department_active;
DROP INDEX IF EXISTS idx_department_questions_conditional;

-- Drop the table
DROP TABLE IF EXISTS department_questions;

COMMIT;

