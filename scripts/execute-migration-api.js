/**
 * Execute migration using Supabase Management API
 */

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
  // Note: The Management API requires a different endpoint
  // We'll use the REST API with service role key
  
  try {
    console.log('🔄 Executing migration via Supabase API...\n')
    
    // The Supabase REST API doesn't support DDL directly
    // We need to use the Management API or PostgREST with proper setup
    // For now, let's try using the database connection directly
    
    // Actually, the best way is to use psql with the connection string
    // But we can also try the Supabase SQL Editor API if available
    
    // Let's use a Node.js PostgreSQL client
    const { Client } = require('pg')
    
    // Get database connection string from Supabase
    // Format: postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
    // We need the database password
    
    console.log('💡 To execute DDL, we need the database password')
    console.log('   You can find it in: Supabase Dashboard > Settings > Database\n')
    
    // Alternative: Use Supabase CLI db push
    console.log('📋 Alternative: Use Supabase CLI')
    console.log('   1. Link your project: supabase link --project-ref ' + projectRef)
    console.log('   2. Push migration: supabase db push\n')
    
    // Or use the SQL directly in Supabase SQL Editor
    console.log('📋 Or copy this SQL to Supabase SQL Editor:')
    console.log('   https://supabase.com/dashboard/project/' + projectRef + '/sql/new\n')
    console.log('='.repeat(60))
    console.log(sql)
    console.log('='.repeat(60))
    
    // Try to execute if we have database password
    const dbPassword = process.env.SUPABASE_DB_PASSWORD
    
    if (dbPassword) {
      console.log('\n🔄 Attempting to execute via PostgreSQL client...\n')
      
      const dbUrl = `postgresql://postgres.${projectRef}:${dbPassword}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`
      
      const client = new Client({
        connectionString: dbUrl,
        ssl: { rejectUnauthorized: false }
      })
      
      try {
        await client.connect()
        console.log('✅ Connected to database')
        
        // Execute the SQL
        await client.query(sql)
        console.log('✅ Migration executed successfully!')
        
        await client.end()
      } catch (error) {
        console.error('❌ Error executing migration:', error.message)
        await client.end()
      }
    } else {
      console.log('\n⚠️  SUPABASE_DB_PASSWORD not found in environment')
      console.log('   Add it to .env.local to execute automatically')
      console.log('   Or run the SQL manually in Supabase SQL Editor')
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message)
    console.log('\n💡 Fallback: Copy the SQL above and run it in Supabase SQL Editor')
  }
}

const migrationFile = process.argv[2] || 'supabase/migrations/20251117094000_fix_user_profiles_policies.sql'

executeMigration(migrationFile).catch(console.error)






