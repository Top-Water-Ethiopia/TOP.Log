/**
 * Run Supabase migration directly using service role
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing environment variables')
  console.error('   Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

// Create admin client (bypasses RLS)
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function runMigration(migrationFile) {
  console.log(`📦 Running migration: ${migrationFile}\n`)
  
  // Read migration file
  const migrationPath = path.join(__dirname, '..', migrationFile)
  if (!fs.existsSync(migrationPath)) {
    console.error(`❌ Migration file not found: ${migrationPath}`)
    process.exit(1)
  }
  
  const sql = fs.readFileSync(migrationPath, 'utf8')
  
  console.log('📋 Migration SQL:')
  console.log('='.repeat(60))
  console.log(sql.substring(0, 500) + '...\n')
  console.log('='.repeat(60) + '\n')
  
  // Split SQL into individual statements
  // Remove comments and empty lines, then split by semicolons
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))
    .filter(s => !s.match(/^\s*SELECT\s+['"]/i)) // Filter out SELECT statements used for verification
  
  console.log(`📝 Found ${statements.length} SQL statements to execute\n`)
  
  // Execute each statement
  let successCount = 0
  let errorCount = 0
  
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i]
    
    // Skip verification SELECT statements
    if (statement.match(/^SELECT\s+/i) && statement.includes('pg_policies')) {
      console.log(`⏭️  Skipping verification query ${i + 1}/${statements.length}`)
      continue
    }
    
    if (statement.match(/^DO\s+\$\$/i)) {
      console.log(`⏭️  Skipping DO block ${i + 1}/${statements.length}`)
      continue
    }
    
    try {
      console.log(`🔄 Executing statement ${i + 1}/${statements.length}...`)
      
      // Use RPC to execute SQL (if available) or direct query
      // Note: Supabase REST API doesn't support DDL directly
      // We need to use the Management API or psql
      
      // Try using the REST API for DML operations
      // For DDL (CREATE, DROP, ALTER), we need a different approach
      
      // Check if it's a DDL statement
      const isDDL = /^\s*(CREATE|DROP|ALTER|GRANT|REVOKE)/i.test(statement)
      
      if (isDDL) {
        console.log(`   ⚠️  DDL statement detected - Supabase REST API cannot execute DDL`)
        console.log(`   💡 You need to run this in Supabase SQL Editor or use psql`)
        console.log(`   📋 Statement: ${statement.substring(0, 100)}...\n`)
        continue
      }
      
      // For DML, we can try to execute
      // But actually, we can't execute arbitrary SQL via REST API
      console.log(`   ⚠️  Cannot execute arbitrary SQL via REST API`)
      console.log(`   💡 Use Supabase SQL Editor or psql to run this migration\n`)
      
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}\n`)
      errorCount++
    }
  }
  
  console.log('\n' + '='.repeat(60))
  console.log(`✅ Successfully processed: ${successCount} statements`)
  if (errorCount > 0) {
    console.log(`❌ Errors: ${errorCount} statements`)
  }
  console.log('\n📋 IMPORTANT:')
  console.log('   Supabase REST API cannot execute DDL statements (CREATE, DROP, ALTER)')
  console.log('   You need to run this migration in one of these ways:')
  console.log('   1. Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql/new')
  console.log('   2. Supabase CLI: supabase db push')
  console.log('   3. psql: Connect directly to your database')
  console.log('\n📁 Migration file location:')
  console.log(`   ${migrationPath}`)
}

// Get migration file from command line
const migrationFile = process.argv[2]

if (!migrationFile) {
  console.error('❌ Please provide a migration file path')
  console.error('   Usage: node scripts/run-migration.js supabase/migrations/20251117094000_fix_user_profiles_policies.sql')
  process.exit(1)
}

runMigration(migrationFile).catch(console.error)






