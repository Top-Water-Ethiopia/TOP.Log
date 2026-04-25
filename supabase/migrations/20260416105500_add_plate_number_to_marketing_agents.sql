-- Add plate_number column to marketing_agents table
ALTER TABLE public.marketing_agents
  ADD COLUMN IF NOT EXISTS plate_number text NULL;
