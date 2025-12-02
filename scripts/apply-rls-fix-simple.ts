#!/usr/bin/env ts-node
/**
 * Simple script to apply RLS fix using direct SQL execution
 * Reads .env.local and executes the SQL via Supabase REST API workaround
 */

import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing environment variables in .env.local')
  process.exit(1)
}

// Extract project reference
const projectRef = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1]

async function applyRLSFix() {
  console.log('🔧 Applying RLS fix for role_questions table...\n')
  
  // Read SQL file
  const sqlFile = path.join(__dirname, '../QUICK_FIX_ROLE_QUESTIONS_RLS.sql')
  const sql = fs.readFileSync(sqlFile, 'utf8')
  
  console.log('📋 SQL file loaded\n')
  console.log('⚠️  Supabase REST API does not support raw SQL execution.')
  console.log('\n💡 Please execute the SQL manually:\n')
  console.log('   1. Go to: https://supabase.com/dashboard/project/' + projectRef + '/sql')
  console.log('   2. Copy the contents of: QUICK_FIX_ROLE_QUESTIONS_RLS.sql')
  console.log('   3. Paste into SQL Editor')
  console.log('   4. Click Run\n')
  
  console.log('Or use this direct link:')
  console.log(`   https://supabase.com/dashboard/project/${projectRef}/sql/new\n`)
}

applyRLSFix().catch(console.error)

