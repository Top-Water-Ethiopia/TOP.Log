/**
 * Execute SQL directly using Supabase client with service role
 * This uses the REST API which has limitations for DDL, but we'll try
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing environment variables')
  process.exit(1)
}

// Create admin client
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function executeSQL(sql) {
  console.log('🔄 Executing SQL...\n')
  
  // Split into statements
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0)
    .filter(s => !s.startsWith('--'))
    .filter(s => !s.match(/^SELECT\s+['"]/i)) // Skip verification SELECTs
  
  console.log(`📝 Found ${statements.length} statements to execute\n`)
  
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i]
    
    // Skip DO blocks and verification queries
    if (stmt.match(/^DO\s+\$\$/i) || stmt.match(/^SELECT\s+['"]/i)) {
      continue
    }
    
    try {
      console.log(`🔄 [${i + 1}/${statements.length}] Executing...`)
      console.log(`   ${stmt.substring(0, 100)}...\n`)
      
      // Try using RPC if available, otherwise we can't execute DDL via REST API
      // The Supabase REST API (PostgREST) doesn't support DDL
      
      // For DDL, we need to use:
      // 1. Supabase SQL Editor (manual)
      // 2. Supabase CLI db push (but has migration tracking issues)
      // 3. Direct psql connection
      
      console.log('   ⚠️  DDL cannot be executed via REST API')
      console.log('   💡 Use Supabase SQL Editor or psql\n')
      
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}\n`)
    }
  }
  
  console.log('\n📋 Since DDL cannot be executed via REST API,')
  console.log('   please run this SQL in Supabase SQL Editor:')
  console.log(`   ${supabaseUrl.replace('/rest/v1', '')}/sql/new\n`)
}

// Read migration file
const migrationFile = process.argv[2] || 'supabase/migrations/20251117094000_fix_user_profiles_policies.sql'
const migrationPath = path.join(__dirname, '..', migrationFile)

if (!fs.existsSync(migrationPath)) {
  console.error(`❌ File not found: ${migrationPath}`)
  process.exit(1)
}

const sql = fs.readFileSync(migrationPath, 'utf8')

console.log('📦 User Profiles RLS Policies Migration\n')
console.log('='.repeat(60) + '\n')

executeSQL(sql).then(() => {
  console.log('='.repeat(60))
  console.log('\n✅ Migration SQL prepared')
  console.log('\n📋 To execute:')
  console.log('   1. Open Supabase SQL Editor')
  console.log('   2. Copy and paste the SQL below')
  console.log('   3. Run it\n')
  console.log('='.repeat(60))
  console.log(sql)
  console.log('='.repeat(60))
}).catch(console.error)






