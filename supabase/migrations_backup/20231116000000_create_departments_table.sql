-- Migration: Create departments table and RLS policies
-- This migration creates the departments table and sets up Row Level Security

-- Departments Table
-- Allows super admins to create and manage departments
CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  code TEXT,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Add department_id to roles table (make it nullable for backward compatibility)
ALTER TABLE roles ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id) ON DELETE SET NULL;

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_departments_active ON departments(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_roles_department ON roles(department_id);

-- Create a function to check if current user is admin
-- This uses SECURITY DEFINER to bypass RLS on user_profiles
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
SECURITY DEFINER
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_id = auth.uid()
    AND role_id = '00000000-0000-0000-0000-000000000001' -- Admin role
    AND is_active = true
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;

-- Enable Row Level Security
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can view active departments" ON departments;
DROP POLICY IF EXISTS "Admins can view all departments" ON departments;
DROP POLICY IF EXISTS "Admins can create departments" ON departments;
DROP POLICY IF EXISTS "Admins can update departments" ON departments;
DROP POLICY IF EXISTS "Admins can delete departments" ON departments;

-- RLS Policies for Departments
-- All authenticated users can read active departments
CREATE POLICY "Users can view active departments"
  ON departments FOR SELECT
  USING (is_active = true);

-- Admins can view all departments (including inactive)
CREATE POLICY "Admins can view all departments"
  ON departments FOR SELECT
  USING (is_admin());

-- Only admins can create departments
CREATE POLICY "Admins can create departments"
  ON departments FOR INSERT
  WITH CHECK (is_admin());

-- Only admins can update departments
CREATE POLICY "Admins can update departments"
  ON departments FOR UPDATE
  USING (is_admin());

-- Only admins can delete departments
CREATE POLICY "Admins can delete departments"
  ON departments FOR DELETE
  USING (is_admin());

-- Trigger for updating timestamps (if function exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_timestamp') THEN
    CREATE TRIGGER update_departments_timestamp
    BEFORE UPDATE ON departments
    FOR EACH ROW EXECUTE PROCEDURE update_timestamp();
  END IF;
END $$;

