// Debug script to check admin access and data
// This script helps understand what's happening with the admin reports

console.log('🔐 Admin Access Debug Tool');
console.log('========================\n');

console.log('🤔 Common Issues:');
console.log('1. Not logged in as admin');
console.log('2. Missing admin role in user_profiles');
console.log('3. RLS policies blocking access\n');

console.log('📋 To fix admin access, run these SQL queries in Supabase:\n');

console.log('-- 1. Check if you have an admin user');
console.log('SELECT id, email FROM auth.users;');
console.log('');

console.log('-- 2. Check user profiles');
console.log('SELECT user_id, name, role_id, is_active FROM user_profiles;');
console.log('');

console.log('-- 3. Check roles');
console.log('SELECT id, name FROM roles;');
console.log('');

console.log('-- 4. If no admin user, create one (replace with your user ID)');
console.log('INSERT INTO user_profiles (user_id, name, email, role_id, is_active)');
console.log("VALUES ('YOUR_USER_ID_HERE', 'Admin User', 'admin@example.com',");
console.log("        '00000000-0000-0000-0000-000000000001', true);");
console.log('');

console.log('🔑 Role IDs:');
console.log('  Super Admin: 00000000-0000-0000-0000-000000000000');
console.log('  Admin:       00000000-0000-0000-0000-000000000001');
console.log('  User:        00000000-0000-0000-0000-000000000002');
console.log('  Viewer:      00000000-0000-0000-0000-000000000003\n');

console.log('📊 Data Verification Queries:\n');

console.log('-- Check if captain_log_entries table has data');
console.log('SELECT COUNT(*) as entry_count FROM captain_log_entries;');
console.log('');

console.log('-- Check if custom_responses table has data');
console.log('SELECT COUNT(*) as response_count FROM custom_responses;');
console.log('');

console.log('-- Check user profiles with entries');
console.log('SELECT up.name, up.email, COUNT(ce.id) as entry_count');
console.log('FROM user_profiles up');
console.log('LEFT JOIN captain_log_entries ce ON up.user_id = ce.user_id');
console.log('GROUP BY up.user_id, up.name, up.email');
console.log('ORDER BY entry_count DESC;');
console.log('');

console.log('🛠️  How to test in browser:');
console.log('========================');
console.log('1. Login as admin at http://localhost:3000/login');
console.log('2. Go to http://localhost:3000/admin/reports');
console.log('3. Open browser console (F12) and check for errors');
console.log('4. Look for toast messages and console logs\n');

console.log('📋 Expected Console Output When Working:');
console.log('=====================================');
console.log('Loaded data: { entries: [...], users: [...], roles: [...], departments: [...] }');
console.log('Users for dropdown: [ { id: "uuid", name: "John Doe", email: "john@example.com" } ]');
console.log('Selected user ID: "uuid"');
console.log('Filtering by: John Doe\n');

console.log('📞 If still having issues:');
console.log('=======================');
console.log('1. Share the browser console output');
console.log('2. Share the results of the SQL queries above');
console.log('3. Check if you can access http://localhost:3000/admin');
console.log('4. Verify your user has admin role in user_profiles');