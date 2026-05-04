BEGIN;

CREATE TABLE IF NOT EXISTS public.marketing_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  sales_promoter_user_id uuid NOT NULL REFERENCES auth.users(id),
  name text NOT NULL,
  location text NULL,
  phone_e164 text NULL,
  phone_raw text NULL,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketing_agents_sales_promoter_department
  ON public.marketing_agents(sales_promoter_user_id, department_id, is_active);

CREATE INDEX IF NOT EXISTS idx_marketing_agents_department_active
  ON public.marketing_agents(department_id, is_active);

CREATE UNIQUE INDEX IF NOT EXISTS marketing_agents_active_name_per_sales_promoter
  ON public.marketing_agents(department_id, sales_promoter_user_id, lower(name))
  WHERE is_active = true;

ALTER TABLE public.marketing_agents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage marketing agents" ON public.marketing_agents;
CREATE POLICY "Admins can manage marketing agents"
  ON public.marketing_agents
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles up
      WHERE up.user_id = auth.uid()
        AND up.role_id IN (
          '00000000-0000-0000-0000-000000000001',
          '00000000-0000-0000-0000-000000000010'
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_profiles up
      WHERE up.user_id = auth.uid()
        AND up.role_id IN (
          '00000000-0000-0000-0000-000000000001',
          '00000000-0000-0000-0000-000000000010'
        )
    )
  );

DROP POLICY IF EXISTS "Sales promoters can view assigned marketing agents" ON public.marketing_agents;
CREATE POLICY "Sales promoters can view assigned marketing agents"
  ON public.marketing_agents
  FOR SELECT
  USING (
    is_active = true
    AND sales_promoter_user_id = auth.uid()
  );

ALTER TABLE public.captain_log_entries
  ADD COLUMN IF NOT EXISTS entry_kind text NOT NULL DEFAULT 'standard';

ALTER TABLE public.captain_log_entries
  ADD COLUMN IF NOT EXISTS subject_agent_id uuid NULL REFERENCES public.marketing_agents(id) ON DELETE SET NULL;

ALTER TABLE public.captain_log_entries
  ADD COLUMN IF NOT EXISTS subject_agent_snapshot jsonb NULL;

UPDATE public.captain_log_entries
SET entry_kind = 'standard'
WHERE entry_kind IS NULL
   OR btrim(entry_kind) = '';

UPDATE public.captain_log_entries
SET subject_department_id = department_id
WHERE subject_department_id IS NULL
  AND department_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'captain_log_entries_entry_kind_check'
      AND conrelid = 'public.captain_log_entries'::regclass
  ) THEN
    ALTER TABLE public.captain_log_entries
      ADD CONSTRAINT captain_log_entries_entry_kind_check
      CHECK (entry_kind IN ('standard', 'agent_call'));
  END IF;
END;
$$;

ALTER TABLE public.captain_log_entries
  DROP CONSTRAINT IF EXISTS captain_log_entries_agent_subject_check;

ALTER TABLE public.captain_log_entries
  ADD CONSTRAINT captain_log_entries_agent_subject_check
  CHECK (
    (
      entry_kind = 'standard'
      AND subject_agent_id IS NULL
      AND subject_agent_snapshot IS NULL
    )
    OR (
      entry_kind = 'agent_call'
      AND subject_agent_id IS NOT NULL
      AND subject_agent_snapshot IS NOT NULL
    )
  );

DROP INDEX IF EXISTS public.captain_log_entries_user_department_date_key;

CREATE UNIQUE INDEX IF NOT EXISTS captain_log_entries_standard_unique
  ON public.captain_log_entries(submitted_by_user_id, subject_department_id, date)
  WHERE entry_kind = 'standard';

CREATE UNIQUE INDEX IF NOT EXISTS captain_log_entries_agent_call_unique
  ON public.captain_log_entries(submitted_by_user_id, subject_department_id, date, subject_agent_id)
  WHERE entry_kind = 'agent_call';

CREATE INDEX IF NOT EXISTS idx_captain_log_entries_subject_agent_id
  ON public.captain_log_entries(subject_agent_id)
  WHERE subject_agent_id IS NOT NULL;

COMMIT;
