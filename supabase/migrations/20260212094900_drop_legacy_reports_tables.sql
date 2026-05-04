BEGIN;

DROP TABLE IF EXISTS public.report_answers;
DROP TABLE IF EXISTS public.reports;
DROP TABLE IF EXISTS public.report_questions;

DELETE FROM public.permissions
WHERE resource = 'reports';

DELETE FROM public.permission_definitions
WHERE resource = 'reports';

COMMIT;
