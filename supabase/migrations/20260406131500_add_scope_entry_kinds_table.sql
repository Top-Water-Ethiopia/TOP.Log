BEGIN;

-- Create the scope_entry_kinds configuration table
CREATE TABLE public.scope_entry_kinds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  department_profession_id uuid NULL REFERENCES public.department_professions(id) ON DELETE CASCADE,
  -- scope_type derived: 'department' if profession_id is null, 'profession' if set
  entry_kind text NOT NULL CHECK (entry_kind IN ('standard', 'agent_call', 'daily_summary')),
  label text NOT NULL, -- e.g., "Daily Summary" or custom "End of Day Report"
  description text NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  color text NULL, -- hex color for UI theming
  icon text NULL, -- icon name for UI
  created_by uuid NULL REFERENCES auth.users(id),
  updated_by uuid NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
  -- Note: No table-level unique constraint here; partial unique indexes below handle NULLs correctly
);

-- Partial unique indexes for scope row uniqueness (handles NULL correctly)
-- Department scope: unique (department_id, entry_kind) when profession_id IS NULL
CREATE UNIQUE INDEX idx_scope_entry_kinds_dept_row_unique
  ON public.scope_entry_kinds(department_id, entry_kind)
  WHERE department_profession_id IS NULL;

-- Profession scope: unique (department_profession_id, entry_kind) when profession_id IS NOT NULL
CREATE UNIQUE INDEX idx_scope_entry_kinds_prof_row_unique
  ON public.scope_entry_kinds(department_profession_id, entry_kind)
  WHERE department_profession_id IS NOT NULL;

-- Partial unique indexes for default uniqueness (handles NULL correctly)
-- Department scope: exactly one default per department
CREATE UNIQUE INDEX idx_scope_entry_kinds_dept_default
  ON public.scope_entry_kinds(department_id)
  WHERE department_profession_id IS NULL AND is_default = true;

-- Profession scope: exactly one default per profession
CREATE UNIQUE INDEX idx_scope_entry_kinds_prof_default
  ON public.scope_entry_kinds(department_profession_id)
  WHERE department_profession_id IS NOT NULL AND is_default = true;

-- Index for faster lookups
CREATE INDEX idx_scope_entry_kinds_lookup
  ON public.scope_entry_kinds(department_id, department_profession_id, is_active);

-- Index for updated_at (useful for caching/sync)
CREATE INDEX idx_scope_entry_kinds_updated_at
  ON public.scope_entry_kinds(updated_at);

-- Enable RLS
ALTER TABLE public.scope_entry_kinds ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- SELECT: authenticated users (both admins and submitters need to read config)
CREATE POLICY "scope_entry_kinds_select_authenticated"
  ON public.scope_entry_kinds
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT/UPDATE/DELETE: admin or departments.manage permission
-- Uses role_id from user_profiles joined with permissions
CREATE POLICY "scope_entry_kinds_insert_admin"
  ON public.scope_entry_kinds
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      JOIN public.permissions p ON p.role_id = up.role_id
      WHERE up.user_id = auth.uid()
      AND (
        up.role_id IN ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010')
        OR (p.resource = 'departments' AND p.action = 'manage')
      )
    )
  );

CREATE POLICY "scope_entry_kinds_update_admin"
  ON public.scope_entry_kinds
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      JOIN public.permissions p ON p.role_id = up.role_id
      WHERE up.user_id = auth.uid()
      AND (
        up.role_id IN ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010')
        OR (p.resource = 'departments' AND p.action = 'manage')
      )
    )
  );

CREATE POLICY "scope_entry_kinds_delete_admin"
  ON public.scope_entry_kinds
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      JOIN public.permissions p ON p.role_id = up.role_id
      WHERE up.user_id = auth.uid()
      AND (
        up.role_id IN ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010')
        OR (p.resource = 'departments' AND p.action = 'manage')
      )
    )
  );

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_scope_entry_kinds_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
CREATE TRIGGER trigger_scope_entry_kinds_updated_at
  BEFORE UPDATE ON public.scope_entry_kinds
  FOR EACH ROW
  EXECUTE FUNCTION public.update_scope_entry_kinds_updated_at();

-- Seed department scopes eagerly (limited seeding)
-- All departments get 'standard' (active, default)
INSERT INTO public.scope_entry_kinds (
  department_id, department_profession_id, entry_kind, label, 
  description, sort_order, is_default, is_active, color, icon
)
SELECT 
  d.id as department_id,
  NULL::uuid as department_profession_id,
  'standard' as entry_kind,
  'Standard' as label,
  'Default report type for general entries' as description,
  0 as sort_order,
  true as is_default,
  true as is_active,
  '#6B7280' as color, -- gray
  'FileText' as icon
FROM public.departments d
ON CONFLICT (department_id, entry_kind) WHERE department_profession_id IS NULL
DO NOTHING;

-- Seed 'agent_call' only if department already has questions with entry_kind = 'agent_call'
INSERT INTO public.scope_entry_kinds (
  department_id, department_profession_id, entry_kind, label, 
  description, sort_order, is_default, is_active, color, icon
)
SELECT DISTINCT
  rq.department_id,
  NULL::uuid as department_profession_id,
  'agent_call' as entry_kind,
  'Agent Call' as label,
  'Used for agent-linked reports with assigned agent dropdown' as description,
  1 as sort_order,
  false as is_default,
  true as is_active,
  '#3B82F6' as color, -- blue
  'Phone' as icon
FROM public.role_questions rq
WHERE rq.entry_kind = 'agent_call'
ON CONFLICT (department_id, entry_kind) WHERE department_profession_id IS NULL
DO NOTHING;

-- Seed 'daily_summary' only if department already has questions with entry_kind = 'daily_summary'
INSERT INTO public.scope_entry_kinds (
  department_id, department_profession_id, entry_kind, label, 
  description, sort_order, is_default, is_active, color, icon
)
SELECT DISTINCT
  rq.department_id,
  NULL::uuid as department_profession_id,
  'daily_summary' as entry_kind,
  'Daily Summary' as label,
  'Used for once-per-day summary reports' as description,
  2 as sort_order,
  false as is_default,
  true as is_active,
  '#10B981' as color, -- green
  'Calendar' as icon
FROM public.role_questions rq
WHERE rq.entry_kind = 'daily_summary'
ON CONFLICT (department_id, entry_kind) WHERE department_profession_id IS NULL
DO NOTHING;

COMMIT;
