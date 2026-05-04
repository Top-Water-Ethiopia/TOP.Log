-- Ensure roles table has department_id column
-- This migration ensures the roles table is properly linked to departments

-- Add department_id to roles table if it doesn't exist
ALTER TABLE roles ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_roles_department ON roles(department_id);

-- Add comment
COMMENT ON COLUMN roles.department_id IS 'Links role to a department. Roles can exist without a department (system roles).';






