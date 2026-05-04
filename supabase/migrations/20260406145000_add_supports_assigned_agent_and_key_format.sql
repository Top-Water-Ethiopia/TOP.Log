-- Migration: Add supports_assigned_agent and lowercase key format constraint
-- Phase 2: Custom Entry Kind Keys by Scope

-- Add capability flag for assigned-agent workflows
ALTER TABLE public.scope_entry_kinds
ADD COLUMN IF NOT EXISTS supports_assigned_agent BOOLEAN NOT NULL DEFAULT false;

-- Remove any existing CHECK constraint on entry_kind column if it exists
ALTER TABLE public.scope_entry_kinds
DROP CONSTRAINT IF EXISTS scope_entry_kinds_entry_kind_check;

-- Add format validation at DB layer: lowercase alphanumeric + underscore, 1-50 chars
-- This prevents duplicate keys that differ only by capitalization (e.g., daily_report vs Daily_Report)
ALTER TABLE public.scope_entry_kinds
ADD CONSTRAINT scope_entry_kinds_key_format CHECK (
  entry_kind ~ '^[a-z0-9_]+$' AND length(entry_kind) <= 50
);

-- Update existing seeded system keys with correct capability defaults
-- These values align with legacy behavior before the capability flag existed

-- 'standard': Default report type, does not support assigned agents
UPDATE public.scope_entry_kinds
SET supports_assigned_agent = false
WHERE entry_kind = 'standard';

-- 'agent_call': Used for agent-linked reports, supports assigned agents (legacy behavior)
UPDATE public.scope_entry_kinds
SET supports_assigned_agent = true
WHERE entry_kind = 'agent_call';

-- 'daily_summary': Once-per-day reports, does not support assigned agents
UPDATE public.scope_entry_kinds
SET supports_assigned_agent = false
WHERE entry_kind = 'daily_summary';

-- Seed 'standard' entry kind for all departments that don't have it yet (as default)
INSERT INTO public.scope_entry_kinds (
  department_id,
  department_profession_id,
  entry_kind,
  label,
  description,
  sort_order,
  is_default,
  is_active,
  supports_assigned_agent,
  color,
  icon
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
  false as supports_assigned_agent,
  '#6B7280' as color,
  'FileText' as icon
FROM public.departments d
WHERE NOT EXISTS (
  SELECT 1 FROM public.scope_entry_kinds sek
  WHERE sek.department_id = d.id
  AND sek.department_profession_id IS NULL
  AND sek.entry_kind = 'standard'
);

-- Seed 'agent_call' only for departments that have questions using it (limited seeding)
INSERT INTO public.scope_entry_kinds (
  department_id,
  department_profession_id,
  entry_kind,
  label,
  description,
  sort_order,
  is_default,
  is_active,
  supports_assigned_agent,
  color,
  icon
)
SELECT DISTINCT
  rq.department_id,
  NULL::uuid,
  'agent_call',
  'Agent Call',
  'Used for agent-linked reports with assigned agent dropdown',
  1,
  false,
  true,
  true,
  '#3B82F6',
  'Phone'
FROM public.role_questions rq
WHERE rq.entry_kind = 'agent_call'
AND NOT EXISTS (
  SELECT 1 FROM public.scope_entry_kinds sek
  WHERE sek.department_id = rq.department_id
  AND sek.department_profession_id IS NULL
  AND sek.entry_kind = 'agent_call'
);

-- Seed 'daily_summary' only for departments that have questions using it (limited seeding)
INSERT INTO public.scope_entry_kinds (
  department_id,
  department_profession_id,
  entry_kind,
  label,
  description,
  sort_order,
  is_default,
  is_active,
  supports_assigned_agent,
  color,
  icon
)
SELECT DISTINCT
  rq.department_id,
  NULL::uuid,
  'daily_summary',
  'Daily Summary',
  'Used for once-per-day summary reports',
  2,
  false,
  true,
  false,
  '#10B981',
  'Calendar'
FROM public.role_questions rq
WHERE rq.entry_kind = 'daily_summary'
AND NOT EXISTS (
  SELECT 1 FROM public.scope_entry_kinds sek
  WHERE sek.department_id = rq.department_id
  AND sek.department_profession_id IS NULL
  AND sek.entry_kind = 'daily_summary'
);

-- Ensure profession-scoped entry kinds follow the same lowercase constraint
-- (already covered by table-level constraint)

COMMENT ON COLUMN public.scope_entry_kinds.supports_assigned_agent IS 'Whether this entry kind supports the assigned agent workflow (capability flag)';
COMMENT ON CONSTRAINT scope_entry_kinds_key_format ON public.scope_entry_kinds IS 'Enforces lowercase alphanumeric + underscore, 1-50 chars to prevent case-duplicates';
