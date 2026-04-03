BEGIN;

WITH marketing_department AS (
  SELECT id
  FROM public.departments
  WHERE lower(name) = lower('Marketing')
  ORDER BY created_at ASC
  LIMIT 1
),
next_sort_order AS (
  SELECT COALESCE(MAX(dp.sort_order), -1) + 1 AS value
  FROM public.department_professions dp
  JOIN marketing_department md ON md.id = dp.department_id
)
INSERT INTO public.department_professions (
  department_id,
  key,
  label,
  description,
  is_active,
  is_default,
  sort_order,
  updated_at
)
SELECT
  md.id,
  'sales-promoter',
  'Sales Promoter',
  NULL,
  true,
  false,
  nso.value,
  now()
FROM marketing_department md
CROSS JOIN next_sort_order nso
WHERE NOT EXISTS (
  SELECT 1
  FROM public.department_professions dp
  WHERE dp.department_id = md.id
    AND dp.key = 'sales-promoter'
);

COMMIT;
