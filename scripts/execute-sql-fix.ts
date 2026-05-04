#!/usr/bin/env tsx
/**
 * Execute SQL fix using Supabase Management API
 * This uses the service role key to execute SQL directly
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅' : '❌');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', serviceRoleKey ? '✅' : '❌');
  process.exit(1);
}

async function executeSQL() {
  console.log('🔧 Executing RLS fix via Supabase Management API...\n');

  // Read SQL file
  const sqlFile = path.join(__dirname, '../supabase/migrations/20251120150000_fix_role_questions_rls_with_security_definer.sql');
  
  if (!fs.existsSync(sqlFile)) {
    console.error(`❌ SQL file not found: ${sqlFile}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlFile, 'utf8');

  try {
    // Use Supabase Management API to execute SQL
    // Note: This requires the project ref from the URL
    const projectRef = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1];
    
    if (!projectRef) {
      throw new Error('Could not extract project ref from Supabase URL');
    }

    console.log(`📋 Project: ${projectRef}`);
    console.log(`📝 Executing SQL from: ${path.basename(sqlFile)}\n`);

    // Use the Management API to execute SQL
    // The Management API endpoint is: https://api.supabase.com/v1/projects/{project_ref}/database/query
    const apiUrl = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: sql,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error:', response.status, response.statusText);
      console.error('Response:', errorText);
      
      // If Management API doesn't work, suggest alternative
      console.error('\n💡 The Management API may not support direct SQL execution.');
      console.error('   Please use the SQL Editor instead:');
      console.error(`   https://supabase.com/dashboard/project/${projectRef}/sql/new\n`);
      
      process.exit(1);
    }

    const result = await response.json();
    console.log('✅ SQL executed successfully!');
    console.log('Result:', JSON.stringify(result, null, 2));

  } catch (error: any) {
    console.error('❌ Error executing SQL:', error.message);
    console.error('\n💡 Alternative: Use the SQL Editor');
    console.error('   1. Open: https://supabase.com/dashboard/project/ukhhrctscwlstwspuhbd/sql/new');
    console.error('   2. Copy the SQL from the migration file');
    console.error('   3. Paste and run it\n');
    
    process.exit(1);
  }
}

executeSQL().catch(console.error);

