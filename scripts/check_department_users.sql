-- PSQL script to check which users are assigned to department
-- Replace 'c2a3b747-2452-47c6-bd76-87be8b098fb7' with your department ID

-- Count users in the department
SELECT COUNT(*) AS user_count
FROM user_profiles
WHERE department_id = 'c2a3b747-2452-47c6-bd76-87be8b098fb7';

-- List all users in the department with details
SELECT 
    up.id AS profile_id,
    up.user_id,
    au.email,
    up.full_name,
    up.is_active,
    up.created_at,
    up.updated_at
FROM user_profiles up
LEFT JOIN auth.users au ON up.user_id = au.id
WHERE up.department_id = 'c2a3b747-2452-47c6-bd76-87be8b098fb7'
ORDER BY up.full_name;

-- Alternative: Quick view with role info
SELECT 
    up.id AS profile_id,
    au.email,
    up.full_name,
    up.is_active,
    r.name AS role_name,
    d.name AS department_name
FROM user_profiles up
LEFT JOIN auth.users au ON up.user_id = au.id
LEFT JOIN roles r ON up.role_id = r.id
LEFT JOIN departments d ON up.department_id = d.id
WHERE up.department_id = 'c2a3b747-2452-47c6-bd76-87be8b098fb7'
ORDER BY up.full_name;
