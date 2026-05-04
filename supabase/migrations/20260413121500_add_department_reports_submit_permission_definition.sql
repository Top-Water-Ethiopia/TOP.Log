-- Add department_reports.submit permission definition (department-scoped)

BEGIN;

INSERT INTO public.permission_definitions (resource, action, description, scope)
VALUES ('department_reports', 'submit', 'Submit a department report on behalf of a department', 'department')
ON CONFLICT (resource, action) DO NOTHING;

COMMIT;

