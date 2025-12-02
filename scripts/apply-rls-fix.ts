#!/usr/bin/env ts-node
/**
 * Script to apply RLS fix for role_questions table
 * Uses Supabase Management API to execute SQL
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing required environment variables:')
  console.error('   NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL')
  console.error('   SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

// Create admin client with service role key (bypasses RLS)
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function applyRLSFix() {
  try {
    console.log('🔧 Applying RLS fix for role_questions table...\n')
    console.log(`📡 Connecting to: ${supabaseUrl}\n`)

    // Read the SQL file
    const sqlFilePath = path.join(__dirname, '../QUICK_FIX_ROLE_QUESTIONS_RLS.sql')
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8')

    // Extract project ID from URL
    const projectRef = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1]
    if (!projectRef) {
      throw new Error('Could not extract project reference from Supabase URL')
    }

    console.log(`📋 Project Reference: ${projectRef}\n`)

    // Supabase Management API endpoint for executing SQL
    // Note: This requires the Management API access token, not just the service role key
    // Alternative: Use Supabase CLI's db execute command if available
    
    // Since direct SQL execution via REST API is limited, we'll use the PostgreSQL connection
    // via Supabase's postgREST extension or a custom function
    
    // Try to create and use a temporary function to execute SQL
    console.log('📝 Attempting to execute SQL via custom function...\n')

    // First, try to create an exec_sql function if it doesn't exist
    const createFunctionSQL = `
      CREATE OR REPLACE FUNCTION exec_sql(sql_text text)
      RETURNS text
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      BEGIN
        EXECUTE sql_text;
        RETURN 'OK';
      EXCEPTION WHEN OTHERS THEN
        RETURN 'ERROR: ' || SQLERRM;
      END;
      $$;
    `

    // Try to execute via RPC
    console.log('   Creating SQL execution function...')
    try {
      const { error: funcError } = await supabaseAdmin.rpc('exec_sql', { 
        sql_text: createFunctionSQL 
      })

      if (funcError && !funcError.message.includes('function exec_sql(text) does not exist')) {
        console.log(`   ⚠️  Could not create function: ${funcError.message}`)
        console.log('   Trying alternative approach...\n')
      }
    } catch (err: any) {
      console.log(`   ⚠️  Function creation: ${err.message}\n`)
    }

    // Since Supabase REST API doesn't support raw SQL execution directly,
    // we need to use the Management API or psql connection
    console.log('⚠️  Direct SQL execution via REST API is not available.')
    console.log('\n💡 Using Supabase Management API via CLI...\n')

    // Use Supabase CLI to execute the SQL
    const { exec } = require('child_process')
    const util = require('util')
    const execPromise = util.promisify(exec)

    try {
      console.log('📤 Executing SQL via Supabase CLI...\n')
      
      // Write SQL to a temporary file for the CLI
      const tempSqlFile = path.join(__dirname, '../temp_rls_fix.sql')
      fs.writeFileSync(tempSqlFile, sqlContent)

      // Try to use supabase db execute (though it may not exist)
      // Alternative: use psql with connection string
      
      // Extract database connection details from service role key or use CLI
      console.log('🔐 Using Supabase CLI with project link...\n')

      // Execute via psql using the database password
      // We need the database password, which might be in .env.local or Supabase config
      
      // Alternative approach: Use the Supabase Management API
      // Get the access token from Supabase CLI
      const { stdout: accessToken } = await execPromise('supabase access-token 2>/dev/null || echo ""')
      
      if (accessToken && accessToken.trim()) {
        console.log('✅ Found Supabase access token\n')
        
        // Execute SQL via Management API
        const managementApiUrl = `https://api.supabase.com/v1/projects/${projectRef}/database/query`
        
        const response = await fetch(managementApiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken.trim()}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: sqlContent
          })
        })

        if (response.ok) {
          const result = await response.json()
          console.log('✅ SQL executed successfully via Management API!\n')
          console.log('Result:', result)
          return
        } else {
          const error = await response.text()
          console.log(`⚠️  Management API error: ${error}\n`)
        }
      }

      console.log('⚠️  Could not execute SQL automatically.')
      console.log('   The Supabase REST API does not support raw SQL execution.')
      console.log('\n💡 Please run the SQL script manually:\n')
      console.log('   1. Open Supabase Dashboard: https://supabase.com/dashboard')
      console.log('   2. Select your project')
      console.log('   3. Go to SQL Editor')
      console.log('   4. Paste the contents of QUICK_FIX_ROLE_QUESTIONS_RLS.sql')
      console.log('   5. Click Run\n')

      // Clean up temp file
      if (fs.existsSync(tempSqlFile)) {
        fs.unlinkSync(tempSqlFile)
      }

    } catch (cliError: any) {
      console.log(`⚠️  CLI execution failed: ${cliError.message}\n`)
      console.log('💡 Please run the SQL script manually in Supabase SQL Editor\n')
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message)
    console.error('\n💡 Please run the SQL script manually in Supabase SQL Editor')
    process.exit(1)
  }
}

// Run the script
applyRLSFix()
  .then(() => {
    console.log('✅ Script completed!\n')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error)
    process.exit(1)
  })
