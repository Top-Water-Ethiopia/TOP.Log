/**
 * Execute migration using psql via Supabase connection
 */

const { createClient } = require('@supabase/supabase-js')
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing environment variables')
  process.exit(1)
}

// Extract project ref from URL
const projectRef = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1]

if (!projectRef) {
  console.error('❌ Could not extract project ref from Supabase URL')
  process.exit(1)
}

async function executeMigration(migrationFile) {
  console.log(`📦 Executing migration: ${migrationFile}\n`)
  
  const migrationPath = path.join(__dirname, '..', migrationFile)
  if (!fs.existsSync(migrationPath)) {
    console.error(`❌ Migration file not found: ${migrationPath}`)
    process.exit(1)
  }
  
  const sql = fs.readFileSync(migrationPath, 'utf8')
  
  console.log('📋 Migration file loaded')
  console.log(`📝 SQL length: ${sql.length} characters\n`)
  
  // Try using Supabase Management API to execute SQL
  // This requires the project API key
  console.log('🔄 Attempting to execute via Supabase Management API...\n')
  
  try {
    // Use Supabase CLI to execute the SQL
    // First, check if we can use supabase db push
    console.log('💡 Using Supabase CLI to execute migration...\n')
    
    // Create a temporary migration file in the migrations directory
    const tempMigrationPath = migrationPath
    
    // Try to execute using supabase db push
    // But first, we need to link the project or use direct connection
    
    // Alternative: Use psql directly with connection string
    // Get database password from environment or Supabase CLI
    
    console.log('📋 Options to run migration:')
    console.log('   1. Use Supabase SQL Editor (recommended)')
    console.log('   2. Use Supabase CLI: supabase db push')
    console.log('   3. Use psql with connection string')
    console.log('\n💡 Since DDL cannot be executed via REST API,')
    console.log('   the best approach is to use Supabase SQL Editor')
    console.log('\n📁 Migration file:')
    console.log(`   ${migrationPath}`)
    console.log('\n📋 SQL to run:')
    console.log('='.repeat(60))
    console.log(sql)
    console.log('='.repeat(60))
    
    // Try to get database connection info
    try {
      const statusOutput = execSync('supabase status 2>&1', { encoding: 'utf8', cwd: path.join(__dirname, '..') })
      console.log('\n📊 Supabase Status:')
      console.log(statusOutput)
    } catch (err) {
      console.log('\n⚠️  Could not get Supabase status')
      console.log('   Make sure you are in a Supabase project directory')
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

const migrationFile = process.argv[2] || 'supabase/migrations/20251117094000_fix_user_profiles_policies.sql'

executeMigration(migrationFile).catch(console.error)






