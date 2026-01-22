BEGIN;

CREATE TABLE IF NOT EXISTS public.department_roles (
  key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  default_can_answer_department_questions BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.department_roles
  ADD COLUMN IF NOT EXISTS label TEXT NOT NULL DEFAULT '';

ALTER TABLE IF EXISTS public.department_roles
  ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;

ALTER TABLE IF EXISTS public.department_roles
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE IF EXISTS public.department_roles
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE IF EXISTS public.department_roles
  ADD COLUMN IF NOT EXISTS default_can_answer_department_questions BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE IF EXISTS public.department_roles
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE IF EXISTS public.department_roles
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.department_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage department roles" ON public.department_roles;
CREATE POLICY "Admins can manage department roles"
  ON public.department_roles
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

INSERT INTO public.department_roles (key, label, sort_order, is_active, is_default, default_can_answer_department_questions)
VALUES
  ('department_lead', 'Department Lead', 10, TRUE, FALSE, TRUE),
  ('department_manager', 'Department Manager', 20, TRUE, FALSE, FALSE),
  ('supervisor', 'Supervisor', 30, TRUE, FALSE, FALSE),
  ('contributor', 'Contributor', 40, TRUE, TRUE, FALSE),
  ('viewer', 'Viewer', 50, TRUE, FALSE, FALSE)
ON CONFLICT (key) DO NOTHING;

UPDATE public.user_department_roles
SET role = 'department_lead'
WHERE role = 'department-lead';

UPDATE public.user_department_roles
SET role = 'department_manager'
WHERE role = 'department-manager';

UPDATE public.department_role_permissions
SET department_role = 'department_lead'
WHERE department_role = 'department-lead';

UPDATE public.department_role_permissions
SET department_role = 'department_manager'
WHERE department_role = 'department-manager';

-- Ensure all existing department role keys exist in the catalog before adding FK constraints.
INSERT INTO public.department_roles (key, label, sort_order, is_active, is_default, default_can_answer_department_questions)
SELECT DISTINCT
  udr.role,
  initcap(replace(udr.role, '_', ' ')),
  999,
  TRUE,
  FALSE,
  FALSE
FROM public.user_department_roles udr
WHERE udr.role IS NOT NULL
  AND udr.role <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.department_roles dr WHERE dr.key = udr.role
  )
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.department_roles (key, label, sort_order, is_active, is_default, default_can_answer_department_questions)
SELECT DISTINCT
  drp.department_role,
  initcap(replace(drp.department_role, '_', ' ')),
  999,
  TRUE,
  FALSE,
  FALSE
FROM public.department_role_permissions drp
WHERE drp.department_role IS NOT NULL
  AND drp.department_role <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.department_roles dr WHERE dr.key = drp.department_role
  )
ON CONFLICT (key) DO NOTHING;

-- Ensure at most one default role (keep the first by sort_order/key).
WITH ranked AS (
  SELECT key, row_number() OVER (ORDER BY sort_order, key) AS rn
  FROM public.department_roles
  WHERE is_default = TRUE
)
UPDATE public.department_roles dr
SET is_default = FALSE,
    updated_at = NOW()
WHERE dr.key IN (SELECT key FROM ranked WHERE rn > 1);

-- Ensure at least one default role.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.department_roles WHERE is_default = TRUE) THEN
    IF EXISTS (SELECT 1 FROM public.department_roles WHERE key = 'contributor') THEN
      UPDATE public.department_roles
      SET is_default = TRUE,
          updated_at = NOW()
      WHERE key = 'contributor';
    ELSE
      UPDATE public.department_roles
      SET is_default = TRUE,
          updated_at = NOW()
      WHERE key = (
        SELECT key
        FROM public.department_roles
        ORDER BY sort_order, key
        LIMIT 1
      );
    END IF;
  END IF;
END $$;

-- Ensure at least one default role can answer department questions.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.department_roles
    WHERE default_can_answer_department_questions = TRUE
      AND is_active = TRUE
  ) THEN
    IF EXISTS (SELECT 1 FROM public.department_roles WHERE key = 'department_lead') THEN
      UPDATE public.department_roles
      SET default_can_answer_department_questions = TRUE,
          updated_at = NOW()
      WHERE key = 'department_lead';
    END IF;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS department_roles_single_default
  ON public.department_roles (is_default)
  WHERE is_default = TRUE;

DO $$
BEGIN
  ALTER TABLE public.user_department_roles
    ADD CONSTRAINT user_department_roles_role_fkey
    FOREIGN KEY (role)
    REFERENCES public.department_roles(key)
    ON UPDATE CASCADE
    ON DELETE RESTRICT;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.department_role_permissions
    ADD CONSTRAINT department_role_permissions_department_role_fkey
    FOREIGN KEY (department_role)
    REFERENCES public.department_roles(key)
    ON UPDATE CASCADE
    ON DELETE RESTRICT;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMIT;
