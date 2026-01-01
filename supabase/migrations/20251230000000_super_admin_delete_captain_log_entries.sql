BEGIN;

DROP POLICY IF EXISTS "Admins can delete all entries" ON public.captain_log_entries;

CREATE POLICY "Super admins can delete all entries"
  ON public.captain_log_entries
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE user_id = auth.uid()
        AND role_id = '00000000-0000-0000-0000-000000000000'::UUID
        AND is_active = true
    )
  );

INSERT INTO public.permissions (id, role_id, resource, action)
VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000000'::UUID, 'entries', 'delete')
ON CONFLICT (role_id, resource, action) DO NOTHING;

COMMIT;
