BEGIN;

-- Ensure ONLY department-lead roles retain entries.aggregate_department.
-- This is safe to run after earlier migrations that may have granted broader access.

DELETE FROM public.role_permissions rp
USING public.roles r
WHERE rp.role_id = r.id
  AND rp.resource = 'entries'
  AND rp.action = 'aggregate_department'
  AND rp.effect = 'allow'
  AND r.name NOT IN ('department-lead', 'department_lead');

COMMIT;

