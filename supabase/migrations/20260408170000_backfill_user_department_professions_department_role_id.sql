BEGIN;

UPDATE public.user_department_professions udp
SET department_role_id = dp.id,
    updated_at = NOW()
FROM public.department_professions dp
WHERE udp.department_role_id IS NULL
  AND udp.department_id = dp.department_id
  AND udp.role IS NOT NULL
  AND (
    lower(replace(udp.role, '_', '-')) = lower(replace(dp.key, '_', '-'))
    OR lower(replace(udp.role, '-', '_')) = lower(replace(dp.key, '-', '_'))
  );

COMMIT;
