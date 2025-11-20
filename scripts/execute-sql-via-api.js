/**
 * Attempt to execute SQL via Supabase Management API
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

async function executeSQL() {
  const sql = fs.readFileSync('supabase/migrations/20251117081000_fix_departments_policies_final.sql', 'utf8')
  
  // Split into individual statements
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 10 && !s.startsWith('--') && !s.match(/^\/\*/))

  console.log(`Executing ${statements.length} SQL statements...\n`)

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i]
    const preview = stmt.substring(0, 60).replace(/\n/g, ' ')
    
    console.log(`[${i + 1}/${statements.length}] ${preview}...`)

    try {
      // Try using Supabase Management API
      // Note: This typically doesn't work for DDL, but let's try
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`
        },
        body: JSON.stringify({ sql: stmt })
      })

      const data = await response.text()
      
      if (response.ok) {
        console.log('   ✅ Success')
      } else {
        console.log(`   ❌ Failed: ${response.status}`)
        console.log(`   Response: ${data.substring(0, 100)}`)
      }
    } catch (error) {
      console.log(`   ⚠️  Error: ${error.message}`)
    }
  }

  console.log('\n💡 Note: Supabase REST API typically cannot execute DDL statements.')
  console.log('   Please run the SQL in Supabase SQL Editor.')
}

executeSQL().catch(console.error)






