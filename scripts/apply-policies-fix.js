/**
 * Apply departments policies fix directly using Supabase service role
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function applyFix() {
  console.log('🔧 Applying departments policies fix...\n')

  const sql = fs.readFileSync('supabase/migrations/20251117081000_fix_departments_policies_final.sql', 'utf8')
  
  // Split SQL into statements
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--') && !s.match(/^\/\*/))

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i]
    if (statement.length < 10) continue

    try {
      // Use REST API to execute SQL
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`
        },
        body: JSON.stringify({ query: statement })
      })

      if (!response.ok) {
        // Try alternative: use Supabase's query builder for DDL
        console.log(`Statement ${i + 1}: ${statement.substring(0, 50)}...`)
        console.log('   ⚠️  Cannot execute DDL via REST API')
      }
    } catch (error) {
      console.log(`Statement ${i + 1}: ${statement.substring(0, 50)}...`)
      console.log('   ⚠️  Error:', error.message)
    }
  }

  console.log('\n💡 Supabase JS client cannot execute DDL statements directly.')
  console.log('   Please run the SQL in Supabase SQL Editor or use psql.')
  console.log('\n📋 SQL to run:')
  console.log('──────────────────────────────────────────────────')
  console.log(sql)
  console.log('──────────────────────────────────────────────────')
}

applyFix().catch(console.error)






