/**
 * Execute migration using Supabase Management API via HTTP
 */

const fs = require('fs')
const path = require('path')
const https = require('https')
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
  console.log(`🔗 Project: ${projectRef}\n`)
  
  const migrationPath = path.join(__dirname, '..', migrationFile)
  if (!fs.existsSync(migrationPath)) {
    console.error(`❌ Migration file not found: ${migrationPath}`)
    process.exit(1)
  }
  
  const sql = fs.readFileSync(migrationPath, 'utf8')
  
  console.log('📋 Migration SQL loaded')
  console.log(`📝 SQL length: ${sql.length} characters\n`)
  
  // Use Supabase Management API
  // The Management API endpoint for executing SQL is:
  // POST https://api.supabase.com/v1/projects/{project_ref}/database/query
  
  console.log('🔄 Executing migration via Supabase Management API...\n')
  
  // Get access token from service role key
  // Actually, we need the Management API key, not the service role key
  // The service role key is for PostgREST, not Management API
  
  // Alternative: Use Supabase CLI db push
  console.log('💡 Supabase Management API requires a different authentication')
  console.log('   Let\'s use Supabase CLI instead\n')
  
  // Check if project is linked
  try {
    const { execSync } = require('child_process')
    const linkCheck = execSync('supabase projects list 2>&1', { encoding: 'utf8', cwd: path.join(__dirname, '..') })
    console.log('📊 Supabase Projects:')
    console.log(linkCheck)
  } catch (err) {
    console.log('⚠️  Could not list projects')
  }
  
  // Try to link and push
  console.log('\n📋 Steps to execute migration:')
  console.log('   1. Link project: supabase link --project-ref ' + projectRef)
  console.log('   2. Push migration: supabase db push\n')
  
  // Or provide the SQL for manual execution
  console.log('📋 Or copy this SQL to Supabase SQL Editor:')
  console.log(`   https://supabase.com/dashboard/project/${projectRef}/sql/new\n`)
  console.log('='.repeat(60))
  console.log(sql)
  console.log('='.repeat(60))
  
  // Try to use Supabase CLI db push
  console.log('\n🔄 Attempting to use Supabase CLI db push...\n')
  
  try {
    const { execSync } = require('child_process')
    
    // First, try to link if not already linked
    try {
      execSync(`supabase link --project-ref ${projectRef} --password "${process.env.SUPABASE_DB_PASSWORD || ''}"`, {
        encoding: 'utf8',
        cwd: path.join(__dirname, '..'),
        stdio: 'pipe'
      })
      console.log('✅ Project linked')
    } catch (linkErr) {
      // Project might already be linked
      console.log('ℹ️  Project may already be linked, continuing...')
    }
    
    // Push the migration
    execSync('supabase db push', {
      encoding: 'utf8',
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit'
    })
    
    console.log('\n✅ Migration pushed successfully!')
    
  } catch (error) {
    console.error('\n❌ Error pushing migration:', error.message)
    console.log('\n💡 Alternative: Run the SQL manually in Supabase SQL Editor')
    console.log(`   URL: https://supabase.com/dashboard/project/${projectRef}/sql/new`)
  }
}

const migrationFile = process.argv[2] || 'supabase/migrations/20251117094000_fix_user_profiles_policies.sql'

executeMigration(migrationFile).catch(console.error)






