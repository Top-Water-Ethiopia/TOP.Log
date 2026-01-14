BEGIN;

CREATE TABLE IF NOT EXISTS permission_definitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  resource TEXT NOT NULL,
  action TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(resource, action)
);

ALTER TABLE IF EXISTS permission_definitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view permission definitions" ON permission_definitions;
DROP POLICY IF EXISTS "Admins can manage permission definitions" ON permission_definitions;

CREATE POLICY "Authenticated users can view permission definitions"
  ON permission_definitions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage permission definitions"
  ON permission_definitions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND (
        role_id = '00000000-0000-0000-0000-000000000001' OR
        role_id = '00000000-0000-0000-0000-000000000000' OR
        role_id = '00000000-0000-0000-0000-000000000010'
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND (
        role_id = '00000000-0000-0000-0000-000000000001' OR
        role_id = '00000000-0000-0000-0000-000000000000' OR
        role_id = '00000000-0000-0000-0000-000000000010'
      )
    )
  );

INSERT INTO permission_definitions (resource, action)
SELECT DISTINCT resource, action
FROM permissions
ON CONFLICT (resource, action) DO NOTHING;

COMMIT;
