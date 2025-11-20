/**
 * Script to apply the role_questions RLS migration
 * Updates RLS policies to include super admin role
 */

import * as dotenv from 'dotenv'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'

// Load environment variables
const projectRoot = process.cwd()
dotenv.config({ path: path.resolve(projectRoot, '.env.local') })
dotenv.config({ path: path.resolve(projectRoot, '.env') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:')
  console.error('   - NEXT_PUBLIC_SUPABASE_URL')
  console.error('   - SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

async function applyMigration() {
  console.log('🚀 Applying role_questions RLS migration...\n')

  try {
    // Read the migration file
    const migrationPath = path.resolve(projectRoot, 'supabase/migrations/20251119000001_update_role_questions_rls_for_super_admin.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8')

    console.log('📄 Migration file loaded')
    console.log('📝 Executing migration...\n')

    // Split the SQL into individual statements (remove BEGIN/COMMIT for individual execution)
    const statements = migrationSQL
      .replace(/BEGIN;?\s*/gi, '')
      .replace(/COMMIT;?\s*/gi, '')
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))

    // Execute each statement
    for (const statement of statements) {
      if (statement.length === 0) continue
      
      console.log(`   Executing: ${statement.substring(0, 60)}...`)
      
      const { error } = await supabase.rpc('exec_sql', { sql: statement }).catch(async () => {
        // If exec_sql doesn't exist, try direct query
        const { error: directError } = await supabase.from('_').select('*').limit(0)
        // Use raw SQL execution via REST API
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ sql: statement }),
        })
        
        if (!response.ok) {
          return { error: new Error(`HTTP ${response.status}: ${await response.text()}`) }
        }
        return { error: null }
      })

      if (error) {
        // Try alternative method - execute via postgrest
        console.log(`   ⚠️  Trying alternative execution method...`)
        
        // For DROP POLICY and CREATE POLICY, we need to use a different approach
        // Let's execute the full SQL as a single statement
        try {
          const fullSQL = migrationSQL.replace(/BEGIN;?\s*/gi, '').replace(/COMMIT;?\s*/gi, '')
          
          // Use Supabase's REST API to execute raw SQL
          const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseServiceKey,
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'Prefer': 'return=representation',
            },
            body: JSON.stringify({ query: fullSQL }),
          })

          if (!response.ok) {
            const errorText = await response.text()
            console.error(`   ❌ Error: ${errorText}`)
            throw new Error(`Failed to execute migration: ${errorText}`)
          }
        } catch (altError: any) {
          console.error('   ❌ Alternative method also failed:', altError.message)
          throw error
        }
      } else {
        console.log('   ✅ Success')
      }
    }

    console.log('\n✅ Migration applied successfully!')
    console.log('\n📋 Next steps:')
    console.log('   1. Refresh the /admin/role-questions page')
    console.log('   2. Check the browser console for loaded questions')
    console.log('   3. Verify questions appear in the table')

  } catch (error: any) {
    console.error('\n❌ Error applying migration:', error.message)
    console.error('\n💡 Alternative: Apply the migration manually in Supabase Dashboard:')
    console.error('   1. Go to Supabase Dashboard → SQL Editor')
    console.error('   2. Copy the contents of: supabase/migrations/20251119000001_update_role_questions_rls_for_super_admin.sql')
    console.error('   3. Paste and run the SQL')
    process.exit(1)
  }
}

// Since Supabase doesn't have a direct SQL execution endpoint via JS client,
// let's provide instructions for manual application
async function main() {
  console.log('📋 Role Questions RLS Migration\n')
  console.log('This migration updates RLS policies to include super admin role.\n')
  
  const migrationPath = path.resolve(process.cwd(), 'supabase/migrations/20251119000001_update_role_questions_rls_for_super_admin.sql')
  const migrationSQL = fs.readFileSync(migrationPath, 'utf-8')
  
  console.log('📄 Migration SQL:')
  console.log('─'.repeat(60))
  console.log(migrationSQL)
  console.log('─'.repeat(60))
  console.log('\n')
  
  console.log('💡 To apply this migration, you have two options:\n')
  console.log('Option 1: Supabase Dashboard (Recommended)')
  console.log('   1. Go to your Supabase Dashboard')
  console.log('   2. Navigate to SQL Editor')
  console.log('   3. Copy and paste the SQL above')
  console.log('   4. Click "Run" to execute\n')
  
  console.log('Option 2: Supabase CLI (if linked)')
  console.log('   supabase db push\n')
  
  console.log('After applying, refresh /admin/role-questions to see your questions!')
}

main()





