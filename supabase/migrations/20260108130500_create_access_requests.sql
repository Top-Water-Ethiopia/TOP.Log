BEGIN;

CREATE TABLE IF NOT EXISTS public.access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  requester_email TEXT,
  requested_role TEXT,
  department_id UUID,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT access_requests_status_check CHECK (status IN ('pending', 'approved', 'rejected', 'resolved'))
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'access_requests_user_id_fkey'
  ) THEN
    ALTER TABLE public.access_requests
      ADD CONSTRAINT access_requests_user_id_fkey
      FOREIGN KEY (user_id)
      REFERENCES auth.users(id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'access_requests_department_id_fkey'
  ) THEN
    ALTER TABLE public.access_requests
      ADD CONSTRAINT access_requests_department_id_fkey
      FOREIGN KEY (department_id)
      REFERENCES public.departments(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'access_requests_resolved_by_fkey'
  ) THEN
    ALTER TABLE public.access_requests
      ADD CONSTRAINT access_requests_resolved_by_fkey
      FOREIGN KEY (resolved_by)
      REFERENCES auth.users(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_access_requests_status ON public.access_requests(status);
CREATE INDEX IF NOT EXISTS idx_access_requests_created_at ON public.access_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_access_requests_user_id ON public.access_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_access_requests_department_id ON public.access_requests(department_id);
CREATE INDEX IF NOT EXISTS idx_access_requests_status_created_at ON public.access_requests(status, created_at);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_access_requests_timestamp'
      AND tgrelid = 'public.access_requests'::regclass
  ) THEN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_timestamp') THEN
      CREATE TRIGGER update_access_requests_timestamp
      BEFORE UPDATE ON public.access_requests
      FOR EACH ROW EXECUTE PROCEDURE update_timestamp();
    END IF;
  END IF;
END $$;

ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can create access requests" ON public.access_requests;
CREATE POLICY "Users can create access requests"
  ON public.access_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own access requests" ON public.access_requests;
CREATE POLICY "Users can view own access requests"
  ON public.access_requests FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view access requests" ON public.access_requests;
CREATE POLICY "Admins can view access requests"
  ON public.access_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles up
      WHERE up.user_id = auth.uid()
        AND up.is_active = true
        AND up.role_id IN (
          '00000000-0000-0000-0000-000000000001'::UUID,
          '00000000-0000-0000-0000-000000000010'::UUID,
          '00000000-0000-0000-0000-000000000000'::UUID
        )
    )
  );

DROP POLICY IF EXISTS "Admins can update access requests" ON public.access_requests;
CREATE POLICY "Admins can update access requests"
  ON public.access_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles up
      WHERE up.user_id = auth.uid()
        AND up.is_active = true
        AND up.role_id IN (
          '00000000-0000-0000-0000-000000000001'::UUID,
          '00000000-0000-0000-0000-000000000010'::UUID,
          '00000000-0000-0000-0000-000000000000'::UUID
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_profiles up
      WHERE up.user_id = auth.uid()
        AND up.is_active = true
        AND up.role_id IN (
          '00000000-0000-0000-0000-000000000001'::UUID,
          '00000000-0000-0000-0000-000000000010'::UUID,
          '00000000-0000-0000-0000-000000000000'::UUID
        )
    )
  );

DROP POLICY IF EXISTS "Admins can delete access requests" ON public.access_requests;
CREATE POLICY "Admins can delete access requests"
  ON public.access_requests FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles up
      WHERE up.user_id = auth.uid()
        AND up.is_active = true
        AND up.role_id IN (
          '00000000-0000-0000-0000-000000000001'::UUID,
          '00000000-0000-0000-0000-000000000010'::UUID,
          '00000000-0000-0000-0000-000000000000'::UUID
        )
    )
  );

COMMIT;
