#!/usr/bin/env node

// Test script to verify department role deletion API
// Run with: node test-department-role-delete.js

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

async function testDeleteRole() {
  try {
    console.log('🧪 Testing department role deletion API...')
    
    // First, try to delete a role that likely has users assigned
    const response = await fetch(`${API_URL}/api/admin/department-roles?key=software_engineer`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': process.env.ADMIN_COOKIE || ''
      }
    })
    
    const result = await response.json()
    
    console.log('📊 Response status:', response.status)
    console.log('📄 Response body:', JSON.stringify(result, null, 2))
    
    if (response.status === 409) {
      console.log('✅ Expected conflict error - role has users assigned')
      if (result.hasAssignments) {
        console.log('✅ API correctly detected user assignments')
      }
      if (result.hasPermissions) {
        console.log('✅ API correctly detected permission assignments')
      }
    } else if (response.status === 200 || response.status === 204) {
      console.log('✅ Role deleted successfully')
    } else {
      console.log('❌ Unexpected response')
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message)
  }
}

console.log('🔧 To run this test:')
console.log('1. Make sure your Next.js dev server is running')
console.log('2. Set ADMIN_COOKIE environment variable with admin session')
console.log('3. Run: node test-department-role-delete.js')
console.log('')
console.log('Example: ADMIN_COOKIE="auth-token=your-token" node test-department-role-delete.js')

if (process.env.ADMIN_COOKIE) {
  testDeleteRole()
}
