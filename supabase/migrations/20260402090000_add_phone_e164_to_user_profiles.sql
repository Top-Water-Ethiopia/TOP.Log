ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS phone_e164 text;

CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_phone_e164_key
ON public.user_profiles (phone_e164)
WHERE phone_e164 IS NOT NULL;
