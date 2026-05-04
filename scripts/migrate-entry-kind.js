const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   - NEXT_PUBLIC_SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runMigration() {
  const migrationFile = path.join(__dirname, '..', 'supabase', 'migrations', '20260406000000_add_entry_kind_to_role_questions.sql');

  console.log('📄 Reading migration file...');
  const sql = fs.readFileSync(migrationFile, 'utf8');

  console.log('🔌 Connecting to Supabase...');
  console.log(`   URL: ${supabaseUrl}`);

  // Split SQL into individual statements (simple split by semicolon)
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*'));

  console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    console.log(`[${i + 1}/${statements.length}] Executing: ${statement.substring(0, 60)}...`);

    try {
      const { error } = await supabase.rpc('exec_sql', { sql: statement + ';' });

      if (error) {
        // If exec_sql function doesn't exist, try direct query
        const { error: queryError } = await supabase.from('_exec_sql').select('*').limit(1);

        if (queryError && queryError.message.includes('does not exist')) {
          console.log('   ⚠️  exec_sql function not available, trying alternative method...');
          // Use REST API or other method
          throw new Error('exec_sql function not available. Please run migration via Supabase SQL Editor.');
        }

        console.error(`   ❌ Error: ${error.message}`);
        throw error;
      }
    } catch (err) {
      // Some statements may fail if they already exist (idempotent), continue
      if (err.message && (
        err.message.includes('already exists') ||
        err.message.includes('duplicate key') ||
        err.message.includes('does not exist')
      )) {
        console.log(`   ⚠️  Skipped (already applied or not applicable)`);
        continue;
      }
      throw err;
    }
  }

  console.log('\n✅ Migration completed successfully!');
}

runMigration().catch(err => {
  console.error('\n❌ Migration failed:', err.message);
  console.log('\n💡 You can also run the SQL manually in Supabase SQL Editor:');
  console.log('   File: supabase/migrations/20260406000000_add_entry_kind_to_role_questions.sql');
  process.exit(1);
});
