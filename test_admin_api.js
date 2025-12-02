// Simple test script to check the admin API endpoint
// Run with: node test_admin_api.js

async function testAdminAPI() {
  console.log('🔍 Testing Admin API Endpoint...\n');
  
  try {
    // Test the API endpoint directly
    console.log('📡 Calling /api/admin/captain-log-entries...');
    const response = await fetch('http://localhost:3000/api/admin/captain-log-entries');
    
    console.log(`📊 Status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      console.log('❌ API Error:');
      const errorText = await response.text();
      console.log(errorText);
      return;
    }
    
    const data = await response.json();
    console.log('\n✅ API Response:');
    console.log('====================');
    
    // Check response structure
    if (Array.isArray(data)) {
      console.log('⚠️  Warning: API returned array instead of object');
      console.log(`📋 Entries count: ${data.length}`);
    } else {
      console.log(`📋 Entries: ${data.entries?.length || 0}`);
      console.log(`👥 Users: ${data.users?.length || 0}`);
      console.log(`💼 Roles: ${data.roles?.length || 0}`);
      console.log(`🏢 Departments: ${data.departments?.length || 0}`);
      
      // Show sample data
      if (data.users && data.users.length > 0) {
        console.log('\n👥 Sample Users:');
        data.users.slice(0, 3).forEach((user, index) => {
          console.log(`  ${index + 1}. ${user.name} (${user.email}) - ${user.id}`);
        });
      }
      
      if (data.entries && data.entries.length > 0) {
        console.log('\n📝 Sample Entries:');
        data.entries.slice(0, 2).forEach((entry, index) => {
          console.log(`  ${index + 1}. ${entry.date} by ${entry.user_profile?.name || 'Unknown'} (${entry.user_id})`);
          console.log(`     Responses: ${entry.custom_responses?.length || 0}`);
        });
      }
    }
    
  } catch (error) {
    console.log('💥 Error:', error.message);
    if (error.cause) {
      console.log('   Cause:', error.cause);
    }
  }
  
  console.log('\n🔧 Database Check Queries:');
  console.log('========================');
  console.log('Run these in Supabase SQL Editor:\n');
  
  console.log('-- Check if users exist');
  console.log('SELECT COUNT(*) as user_count FROM user_profiles WHERE is_active = true;\n');
  
  console.log('-- Check if entries exist');
  console.log('SELECT COUNT(*) as entry_count FROM captain_log_entries;\n');
  
  console.log('-- Check user profiles with entries');
  console.log('SELECT up.name, up.email, COUNT(ce.id) as entry_count');
  console.log('FROM user_profiles up');
  console.log('LEFT JOIN captain_log_entries ce ON up.user_id = ce.user_id');
  console.log('WHERE up.is_active = true');
  console.log('GROUP BY up.user_id, up.name, up.email');
  console.log('ORDER BY entry_count DESC;\n');
}

// Run the test
testAdminAPI();