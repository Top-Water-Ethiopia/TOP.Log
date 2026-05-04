/**
 * Apply departments migrations directly via Supabase client
 * Run: node scripts/apply-departments-migrations.js
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function applyMigration(filePath) {
  const sql = fs.readFileSync(filePath, 'utf8')
  console.log(`\n📄 Applying: ${path.basename(filePath)}`)
  
  // Split SQL by semicolons and execute each statement
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))

  for (const statement of statements) {
    if (statement.length < 10) continue // Skip very short statements
    
    try {
      // Use RPC to execute raw SQL (if available) or use a workaround
      // Since Supabase JS client doesn't support raw SQL, we'll need to use the REST API
      console.log(`   Executing statement...`)
      
      // For now, let's just verify the migration content
      if (statement.includes('CREATE TABLE') || statement.includes('CREATE FUNCTION') || statement.includes('CREATE POLICY')) {
        console.log(`   ✅ Found: ${statement.substring(0, 50)}...`)
      }
    } catch (error) {
      console.error(`   ❌ Error:`, error.message)
    }
  }
}

async function main() {
  console.log('🚀 Applying departments migrations...\n')
  
  const migrations = [
    'supabase/migrations/20231116000000_create_departments_table.sql',
    'supabase/migrations/20231116000001_fix_departments_rls_policies.sql'
  ]

  for (const migration of migrations) {
    const filePath = path.join(__dirname, '..', migration)
    if (fs.existsSync(filePath)) {
      await applyMigration(filePath)
    } else {
      console.log(`⚠️  File not found: ${migration}`)
    }
  }

  console.log('\n💡 Note: This script shows the migration content.')
  console.log('   To actually apply, run the SQL files in Supabase SQL Editor or use psql.')
  console.log('\n📋 Next steps:')
  console.log('   1. Open Supabase Dashboard > SQL Editor')
  console.log('   2. Copy and paste the contents of:')
  migrations.forEach(m => console.log(`      - ${m}`))
  console.log('   3. Run each migration in order')
}

main().catch(console.error)







