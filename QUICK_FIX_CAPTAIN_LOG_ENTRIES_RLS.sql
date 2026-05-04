-- QUICK FIX: Add admin policies for captain_log_entries
-- Run this in Supabase SQL Editor if admins can't view all entries
-- This adds policies that allow admins and super admins to view/manage all entries

BEGIN;

-- Add admin SELECT policy (admins can view all entries)
DROP POLICY IF EXISTS "Admins can view all entries" ON captain_log_entries;
CREATE POLICY "Admins can view all entries"
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
DROP POLICY IF EXISTS "Admins can create entries" ON captain_log_entries;
CREATE POLICY "Admins can create entries"
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
DROP POLICY IF EXISTS "Admins can update all entries" ON captain_log_entries;
CREATE POLICY "Admins can update all entries"
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
DROP POLICY IF EXISTS "Admins can delete all entries" ON captain_log_entries;
CREATE POLICY "Admins can delete all entries"
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

