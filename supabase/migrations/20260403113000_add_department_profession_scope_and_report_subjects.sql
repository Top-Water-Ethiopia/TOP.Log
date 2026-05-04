BEGIN;

ALTER TABLE public.role_questions
  ADD COLUMN IF NOT EXISTS department_profession_id uuid NULL REFERENCES public.department_professions(id) ON DELETE SET NULL;

UPDATE public.role_questions rq
SET department_profession_id = dp.id
FROM public.department_professions dp
WHERE rq.department_profession_id IS NULL
  AND rq.department_id IS NOT NULL
  AND rq.department_role IS NOT NULL
  AND dp.department_id = rq.department_id
  AND (
    dp.key = rq.department_role
    OR dp.id::text = rq.department_role
  );

CREATE INDEX IF NOT EXISTS idx_role_questions_department_profession_id
  ON public.role_questions(department_profession_id)
  WHERE department_profession_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_role_questions_department_profession_display_order
  ON public.role_questions(department_profession_id, display_order)
  WHERE department_profession_id IS NOT NULL;

ALTER TABLE public.captain_log_entries
  ADD COLUMN IF NOT EXISTS submitted_by_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.captain_log_entries
  ADD COLUMN IF NOT EXISTS report_kind text NOT NULL DEFAULT 'personal';

ALTER TABLE public.captain_log_entries
  ADD COLUMN IF NOT EXISTS subject_department_id uuid NULL REFERENCES public.departments(id) ON DELETE SET NULL;

ALTER TABLE public.captain_log_entries
  ADD COLUMN IF NOT EXISTS subject_profession_id uuid NULL REFERENCES public.department_professions(id) ON DELETE SET NULL;

UPDATE public.captain_log_entries
SET submitted_by_user_id = user_id
WHERE submitted_by_user_id IS NULL;

UPDATE public.captain_log_entries
SET subject_department_id = department_id
WHERE subject_department_id IS NULL
  AND department_id IS NOT NULL;

UPDATE public.captain_log_entries cle
SET subject_profession_id = udp.department_role_id
FROM public.user_department_professions udp
WHERE cle.subject_profession_id IS NULL
  AND cle.user_id = udp.user_id
  AND udp.is_active = TRUE
  AND (
    (cle.subject_department_id IS NOT NULL AND udp.department_id = cle.subject_department_id)
    OR (cle.department_id IS NOT NULL AND udp.department_id = cle.department_id)
  );

UPDATE public.captain_log_entries
SET report_kind = 'personal'
WHERE report_kind IS NULL
   OR btrim(report_kind) = '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'captain_log_entries_report_kind_check'
      AND conrelid = 'public.captain_log_entries'::regclass
  ) THEN
    ALTER TABLE public.captain_log_entries
      ADD CONSTRAINT captain_log_entries_report_kind_check
      CHECK (report_kind IN ('personal', 'department', 'mixed'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_captain_log_entries_submitted_by_user_id
  ON public.captain_log_entries(submitted_by_user_id);

CREATE INDEX IF NOT EXISTS idx_captain_log_entries_subject_department_id
  ON public.captain_log_entries(subject_department_id);

CREATE INDEX IF NOT EXISTS idx_captain_log_entries_subject_profession_id
  ON public.captain_log_entries(subject_profession_id)
  WHERE subject_profession_id IS NOT NULL;

COMMIT;
