-- Add foreign key from captain_log_entries to user_profiles
-- This enables relational joins in PostgREST/Supabase client

ALTER TABLE public.captain_log_entries
ADD CONSTRAINT captain_log_entries_user_profiles_user_id_fkey
FOREIGN KEY (user_id) REFERENCES public.user_profiles(user_id);

-- Add index for the foreign key if it doesn't exist (though user_id is already indexed, it helps to be explicit)
CREATE INDEX IF NOT EXISTS idx_captain_log_entries_user_id ON public.captain_log_entries(user_id);
