/**
 * Apply is_admin() fix directly using Supabase service role
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

// Use service role to bypass RLS
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function applyFix() {
  console.log('🔧 Applying is_admin() fix...\n')

  const sql = fs.readFileSync('supabase/migrations/20231116000013_fix_is_admin_final.sql', 'utf8')
  
  // Split by semicolons and execute each statement
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*'))

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i]
    if (statement.length < 10) continue

    try {
      console.log(`Executing statement ${i + 1}/${statements.length}...`)
      
      // Use RPC to execute raw SQL via Supabase
      // Note: Supabase doesn't have direct SQL execution, so we'll use the REST API
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`
        },
        body: JSON.stringify({ sql: statement })
      })

      // Actually, Supabase doesn't have exec_sql RPC by default
      // Let's use a different approach - execute via psql or use the admin API
      console.log('⚠️  Supabase JS client cannot execute raw SQL')
      console.log('   Please run this SQL in Supabase SQL Editor:')
      console.log('   ──────────────────────────────────────────')
      console.log(sql)
      console.log('   ──────────────────────────────────────────')
      break
    } catch (error) {
      console.error(`Error:`, error.message)
    }
  }
}

// Actually, let's just show the SQL since Supabase JS can't execute raw SQL
console.log('📋 SQL to run in Supabase SQL Editor:\n')
console.log('──────────────────────────────────────────────────')
const sql = fs.readFileSync('supabase/migrations/20231116000013_fix_is_admin_final.sql', 'utf8')
console.log(sql)
console.log('──────────────────────────────────────────────────')
console.log('\n💡 Copy the SQL above and run it in:')
console.log('   Supabase Dashboard > SQL Editor')






