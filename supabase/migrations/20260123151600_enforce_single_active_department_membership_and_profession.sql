-- Enforce single active department membership and single active profession assignment per user

-- 1) Clean up existing data (keep most recently updated active row per user)

WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY updated_at DESC, created_at DESC) AS rn
  FROM public.user_department_roles
  WHERE is_active = TRUE
)
UPDATE public.user_department_roles udr
SET is_active = FALSE,
    updated_at = NOW()
FROM ranked r
WHERE udr.id = r.id
  AND r.rn > 1;

WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY updated_at DESC, created_at DESC) AS rn
  FROM public.user_department_professions
  WHERE is_active = TRUE
)
UPDATE public.user_department_professions udp
SET is_active = FALSE,
    updated_at = NOW()
FROM ranked r
WHERE udp.id = r.id
  AND r.rn > 1;

-- 2) Unique: at most one active department membership per user

CREATE UNIQUE INDEX IF NOT EXISTS user_department_roles_one_active_membership_per_user
  ON public.user_department_roles (user_id)
  WHERE is_active = TRUE;

-- 3) Unique: at most one active profession assignment per user

CREATE UNIQUE INDEX IF NOT EXISTS user_department_professions_one_active_profession_per_user
  ON public.user_department_professions (user_id)
  WHERE is_active = TRUE;

-- 4) Trigger: active profession must match an active membership department

CREATE OR REPLACE FUNCTION public.enforce_profession_matches_active_department()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_active IS TRUE THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.user_department_roles udr
      WHERE udr.user_id = NEW.user_id
        AND udr.department_id = NEW.department_id
        AND udr.is_active = TRUE
    ) THEN
      RAISE EXCEPTION 'Active profession must match an active department membership';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profession_matches_active_department
  ON public.user_department_professions;

CREATE TRIGGER trg_profession_matches_active_department
BEFORE INSERT OR UPDATE ON public.user_department_professions
FOR EACH ROW
EXECUTE FUNCTION public.enforce_profession_matches_active_department();
