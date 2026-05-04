-- Refresh PostgREST schema cache after removing role_id column

BEGIN;

-- Add a comment to trigger schema refresh
COMMENT ON TABLE public.role_questions IS 'Role questions table with department-based scoping (role_id removed)';

COMMIT;
