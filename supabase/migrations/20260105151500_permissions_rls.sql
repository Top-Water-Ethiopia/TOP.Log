BEGIN;

ALTER TABLE IF EXISTS permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view permissions for their role" ON permissions;
DROP POLICY IF EXISTS "Admins can view all permissions" ON permissions;
DROP POLICY IF EXISTS "Admins can manage permissions" ON permissions;

CREATE POLICY "Authenticated users can view permissions for their role"
  ON permissions FOR SELECT
  TO authenticated
  USING (
    role_id IN (
      SELECT role_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all permissions"
  ON permissions FOR SELECT
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
  );

CREATE POLICY "Admins can manage permissions"
  ON permissions FOR ALL
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

COMMIT;
