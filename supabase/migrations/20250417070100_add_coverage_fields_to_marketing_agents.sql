-- Add coverage fields to marketing_agents for flexible region/city/route assignment
ALTER TABLE marketing_agents
  ADD COLUMN IF NOT EXISTS region_id uuid REFERENCES public.regions(id),
  ADD COLUMN IF NOT EXISTS coverage_type text CHECK (coverage_type IN ('region', 'city', 'route')),
  ADD COLUMN IF NOT EXISTS area_name text,
  ADD COLUMN IF NOT EXISTS sub_area text;

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_marketing_agents_region ON marketing_agents(region_id);
CREATE INDEX IF NOT EXISTS idx_marketing_agents_coverage ON marketing_agents(coverage_type);

-- Add composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_marketing_agents_region_coverage ON marketing_agents(region_id, coverage_type);

COMMENT ON COLUMN marketing_agents.region_id IS 'Reference to Ethiopian region';
COMMENT ON COLUMN marketing_agents.coverage_type IS 'Type of coverage: region-wide, city-specific, or route-based';
COMMENT ON COLUMN marketing_agents.area_name IS 'City name or region name depending on coverage_type';
COMMENT ON COLUMN marketing_agents.sub_area IS 'Route details when coverage_type is route';
