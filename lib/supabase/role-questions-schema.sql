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

-- Role Questions Table
-- Allows admins to create custom questions for specific roles
CREATE TABLE IF NOT EXISTS role_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  question_key TEXT NOT NULL,
  question_label TEXT NOT NULL,
  question_type TEXT NOT NULL CHECK (question_type IN ('text', 'textarea', 'select', 'multiselect', 'checkbox', 'number', 'date')),
  question_description TEXT,
  placeholder TEXT,
  options JSONB, -- For select/multiselect types: ["option1", "option2"]
  is_required BOOLEAN NOT NULL DEFAULT FALSE,
  display_order INTEGER NOT NULL DEFAULT 0,
  validation_rules JSONB, -- e.g., {"min": 0, "max": 100, "pattern": "..."}
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,
  UNIQUE(role_id, question_key)
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_departments_active ON departments(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_roles_department ON roles(department_id);
CREATE INDEX IF NOT EXISTS idx_role_questions_role ON role_questions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_questions_active ON role_questions(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_role_questions_role_active ON role_questions(role_id, is_active);

-- Enable Row Level Security
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_questions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Departments
-- All authenticated users can read active departments
CREATE POLICY "Users can view active departments"
  ON departments FOR SELECT
  USING (is_active = true);

-- Admins can view all departments (including inactive)
CREATE POLICY "Admins can view all departments"
  ON departments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND role_id = '00000000-0000-0000-0000-000000000001' -- Admin role
    )
  );

-- Only admins can create departments
CREATE POLICY "Admins can create departments"
  ON departments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND role_id = '00000000-0000-0000-0000-000000000001' -- Admin role
    )
  );

-- Only admins can update departments
CREATE POLICY "Admins can update departments"
  ON departments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND role_id = '00000000-0000-0000-0000-000000000001' -- Admin role
    )
  );

-- Only admins can delete departments
CREATE POLICY "Admins can delete departments"
  ON departments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND role_id = '00000000-0000-0000-0000-000000000001' -- Admin role
    )
  );

-- RLS Policies for Role Questions
-- Users can view active questions for their role
CREATE POLICY "Users can view questions for their role"
  ON role_questions FOR SELECT
  USING (
    is_active = true AND
    role_id IN (
      SELECT role_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

-- Admins can view all questions
CREATE POLICY "Admins can view all role questions"
  ON role_questions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND role_id = '00000000-0000-0000-0000-000000000001' -- Admin role
    )
  );

-- Only admins can create, update, and delete questions
CREATE POLICY "Admins can create role questions"
  ON role_questions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND role_id = '00000000-0000-0000-0000-000000000001' -- Admin role
    )
  );

CREATE POLICY "Admins can update role questions"
  ON role_questions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND role_id = '00000000-0000-0000-0000-000000000001' -- Admin role
    )
  );

CREATE POLICY "Admins can delete role questions"
  ON role_questions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND role_id = '00000000-0000-0000-0000-000000000001' -- Admin role
    )
  );

-- Trigger for updating timestamps
CREATE TRIGGER update_departments_timestamp
BEFORE UPDATE ON departments
FOR EACH ROW EXECUTE PROCEDURE update_timestamp();

CREATE TRIGGER update_role_questions_timestamp
BEFORE UPDATE ON role_questions
FOR EACH ROW EXECUTE PROCEDURE update_timestamp();

