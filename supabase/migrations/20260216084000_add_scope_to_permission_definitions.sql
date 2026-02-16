-- Migration: Add scope column to permission_definitions
-- This allows permissions to be categorized as system, department, or both scopes

BEGIN;

-- Add scope column with default 'both'
ALTER TABLE permission_definitions
ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'both';

-- Add constraint to ensure valid scope values
ALTER TABLE permission_definitions
ADD CONSTRAINT permission_definitions_scope_check
CHECK (scope IN ('system', 'department', 'both'));

-- Update existing permissions based on their nature
-- System-only: global administration functions
UPDATE permission_definitions
SET scope = 'system'
WHERE resource IN ('admin', 'users');

-- System-only: department management (creating/deleting departments, not within them)
UPDATE permission_definitions
SET scope = 'system'
WHERE resource = 'departments' 
AND action IN ('create', 'delete');

-- Department-only: personal/individual scoped actions
UPDATE permission_definitions
SET scope = 'department'
WHERE resource IN ('entries', 'analytics')
AND action IN ('read.own', 'export.own');

-- Both: shared actions that make sense in both contexts
-- entries.create, entries.read, entries.update, etc. remain 'both'
-- departments.members.read, departments.members.manage remain 'both'
-- reports.*, analytics.read, analytics.team remain 'both'

COMMIT;
