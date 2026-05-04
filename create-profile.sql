-- Create user profile for user: 299dfc32-f0ab-4ec6-bf1d-98c26754a448
-- Run this in Supabase SQL Editor

INSERT INTO user_profiles (user_id, name, role_id, is_active)
VALUES (
  '299dfc32-f0ab-4ec6-bf1d-98c26754a448',
  'User', -- Change this to the actual name if you know it
  '00000000-0000-0000-0000-000000000002', -- Default user role (change to admin role ID if you want admin)
  true
)
ON CONFLICT (user_id) DO UPDATE 
SET 
  role_id = COALESCE(EXCLUDED.role_id, user_profiles.role_id),
  is_active = COALESCE(EXCLUDED.is_active, user_profiles.is_active);

-- To make this user an admin, run this instead:
-- UPDATE user_profiles 
-- SET role_id = '00000000-0000-0000-0000-000000000001'
-- WHERE user_id = '299dfc32-f0ab-4ec6-bf1d-98c26754a448';








