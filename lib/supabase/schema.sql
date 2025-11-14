-- Setup Row Level Security and necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Captain Log Entries Table
CREATE TABLE IF NOT EXISTS captain_log_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  objectives TEXT,
  key_results TEXT,
  challenges TEXT,
  development_tasks TEXT,
  features_completed TEXT,
  challenges_and_blockers TEXT,
  code_and_priorities TEXT,
  system_improvements TEXT,
  project_updates TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INT NOT NULL DEFAULT 1,
  metadata JSONB,
  UNIQUE(user_id, date)
);

-- Custom Responses Table
CREATE TABLE IF NOT EXISTS custom_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_id UUID NOT NULL REFERENCES captain_log_entries(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL,
  question_key TEXT NOT NULL,
  question_label TEXT,
  question_type TEXT,
  question_category TEXT,
  value JSONB NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  operation TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  changes JSONB,
  metadata JSONB,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Roles Table
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Permissions Table
CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  resource TEXT NOT NULL,
  action TEXT NOT NULL,
  conditions JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(role_id, resource, action)
);

-- User Profiles Table (extends auth.users)
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  department TEXT,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB,
  last_login TIMESTAMPTZ
);

-- Insert default roles
INSERT INTO roles (id, name, description) 
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'admin', 'Administrator with full access'),
  ('00000000-0000-0000-0000-000000000002', 'user', 'Standard user')
ON CONFLICT (name) DO NOTHING;

-- Insert default permissions
INSERT INTO permissions (id, role_id, resource, action)
VALUES
  -- Admin permissions (full access)
  (uuid_generate_v4(), '00000000-0000-0000-0000-000000000001', 'entries', 'create'),
  (uuid_generate_v4(), '00000000-0000-0000-0000-000000000001', 'entries', 'read'),
  (uuid_generate_v4(), '00000000-0000-0000-0000-000000000001', 'entries', 'update'),
  (uuid_generate_v4(), '00000000-0000-0000-0000-000000000001', 'entries', 'delete'),
  (uuid_generate_v4(), '00000000-0000-0000-0000-000000000001', 'entries', 'export'),
  (uuid_generate_v4(), '00000000-0000-0000-0000-000000000001', 'entries', 'import'),
  (uuid_generate_v4(), '00000000-0000-0000-0000-000000000001', 'users', 'create'),
  (uuid_generate_v4(), '00000000-0000-0000-0000-000000000001', 'users', 'read'),
  (uuid_generate_v4(), '00000000-0000-0000-0000-000000000001', 'users', 'update'),
  (uuid_generate_v4(), '00000000-0000-0000-0000-000000000001', 'users', 'delete'),
  
  -- Standard user permissions (own resources only)
  (uuid_generate_v4(), '00000000-0000-0000-0000-000000000002', 'entries', 'create'),
  (uuid_generate_v4(), '00000000-0000-0000-0000-000000000002', 'entries', 'read'),
  (uuid_generate_v4(), '00000000-0000-0000-0000-000000000002', 'entries', 'update'),
  (uuid_generate_v4(), '00000000-0000-0000-0000-000000000002', 'entries', 'delete'),
  (uuid_generate_v4(), '00000000-0000-0000-0000-000000000002', 'entries', 'export')
ON CONFLICT DO NOTHING;

-- Enable Row Level Security
ALTER TABLE captain_log_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;

-- Create policies
-- Captain Log Entries policies
CREATE POLICY "Users can view their own entries" 
  ON captain_log_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own entries" 
  ON captain_log_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own entries" 
  ON captain_log_entries FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own entries" 
  ON captain_log_entries FOR DELETE
  USING (auth.uid() = user_id);

-- Custom Responses policies
CREATE POLICY "Users can view their own responses" 
  ON custom_responses FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM captain_log_entries
    WHERE captain_log_entries.id = custom_responses.entry_id
    AND captain_log_entries.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert their own responses" 
  ON custom_responses FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM captain_log_entries
    WHERE captain_log_entries.id = custom_responses.entry_id
    AND captain_log_entries.user_id = auth.uid()
  ));

-- Audit logs policies (admins can see all, users can see their own)
CREATE POLICY "Users can view their own audit logs" 
  ON audit_logs FOR SELECT
  USING (auth.uid() = user_id);

-- User profiles policies
CREATE POLICY "Users can view their own profile" 
  ON user_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" 
  ON user_profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- Trigger for updating timestamps
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updating timestamps
CREATE TRIGGER update_captain_log_entries_timestamp
BEFORE UPDATE ON captain_log_entries
FOR EACH ROW EXECUTE PROCEDURE update_timestamp();

CREATE TRIGGER update_user_profiles_timestamp
BEFORE UPDATE ON user_profiles
FOR EACH ROW EXECUTE PROCEDURE update_timestamp();

CREATE TRIGGER update_roles_timestamp
BEFORE UPDATE ON roles
FOR EACH ROW EXECUTE PROCEDURE update_timestamp();

CREATE TRIGGER update_permissions_timestamp
BEFORE UPDATE ON permissions
FOR EACH ROW EXECUTE PROCEDURE update_timestamp();
