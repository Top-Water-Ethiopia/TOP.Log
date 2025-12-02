-- Add admin policies for captain_log_entries table
-- This allows admins and super admins to view, create, update, and delete all entries
-- Regular users can still only access their own entries

BEGIN;

-- Add admin SELECT policy (admins can view all entries)
CREATE POLICY IF NOT EXISTS "Admins can view all entries"
  ON captain_log_entries FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND (role_id = '00000000-0000-0000-0000-000000000001'::UUID -- Admin
           OR role_id = '00000000-0000-0000-0000-000000000000'::UUID) -- Super Admin
      AND is_active = true
    )
  );

-- Add admin INSERT policy (admins can create entries for any user)
CREATE POLICY IF NOT EXISTS "Admins can create entries"
  ON captain_log_entries FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND (role_id = '00000000-0000-0000-0000-000000000001'::UUID -- Admin
           OR role_id = '00000000-0000-0000-0000-000000000000'::UUID) -- Super Admin
      AND is_active = true
    )
  );

-- Add admin UPDATE policy (admins can update any entry)
CREATE POLICY IF NOT EXISTS "Admins can update all entries"
  ON captain_log_entries FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND (role_id = '00000000-0000-0000-0000-000000000001'::UUID -- Admin
           OR role_id = '00000000-0000-0000-0000-000000000000'::UUID) -- Super Admin
      AND is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND (role_id = '00000000-0000-0000-0000-000000000001'::UUID -- Admin
           OR role_id = '00000000-0000-0000-0000-000000000000'::UUID) -- Super Admin
      AND is_active = true
    )
  );

-- Add admin DELETE policy (admins can delete any entry)
CREATE POLICY IF NOT EXISTS "Admins can delete all entries"
  ON captain_log_entries FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND (role_id = '00000000-0000-0000-0000-000000000001'::UUID -- Admin
           OR role_id = '00000000-0000-0000-0000-000000000000'::UUID) -- Super Admin
      AND is_active = true
    )
  );

COMMIT;

-- Verify policies were created
SELECT 
  policyname, 
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'captain_log_entries' 
ORDER BY policyname;

