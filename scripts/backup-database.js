/**
 * Backup Supabase database schema and data
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

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function backupDatabase() {
  console.log('📦 Creating database backup...\n')
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
  const backupDir = path.join(__dirname, '..', 'backups', timestamp)
  
  // Create backup directory
  if (!fs.existsSync(path.join(__dirname, '..', 'backups'))) {
    fs.mkdirSync(path.join(__dirname, '..', 'backups'), { recursive: true })
  }
  fs.mkdirSync(backupDir, { recursive: true })
  
  console.log(`📁 Backup directory: ${backupDir}\n`)
  
  // Backup user_profiles data
  console.log('📋 Backing up user_profiles...')
  const { data: profiles, error: profilesError } = await supabase
    .from('user_profiles')
    .select('*')
  
  if (profilesError) {
    console.error('❌ Error backing up user_profiles:', profilesError.message)
  } else {
    fs.writeFileSync(
      path.join(backupDir, 'user_profiles.json'),
      JSON.stringify(profiles, null, 2)
    )
    console.log(`✅ Backed up ${profiles?.length || 0} user profiles`)
  }
  
  // Backup departments data
  console.log('📋 Backing up departments...')
  const { data: departments, error: deptError } = await supabase
    .from('departments')
    .select('*')
  
  if (deptError) {
    console.log(`⚠️  Departments table might not exist: ${deptError.message}`)
  } else {
    fs.writeFileSync(
      path.join(backupDir, 'departments.json'),
      JSON.stringify(departments, null, 2)
    )
    console.log(`✅ Backed up ${departments?.length || 0} departments`)
  }
  
  // Backup roles data
  console.log('📋 Backing up roles...')
  const { data: roles, error: rolesError } = await supabase
    .from('roles')
    .select('*')
  
  if (rolesError) {
    console.error('❌ Error backing up roles:', rolesError.message)
  } else {
    fs.writeFileSync(
      path.join(backupDir, 'roles.json'),
      JSON.stringify(roles, null, 2)
    )
    console.log(`✅ Backed up ${roles?.length || 0} roles`)
  }
  
  // Create SQL backup of current schema
  console.log('\n📋 Creating SQL schema backup...')
  const schemaBackup = `
-- Database Backup: ${new Date().toISOString()}
-- This is a backup of the current state before resetting departments setup

-- Note: This backup only includes data, not schema
-- To restore, you would need to:
-- 1. Restore the schema from migrations
-- 2. Restore the data from JSON files in this backup

-- User Profiles Backup
-- See: user_profiles.json

-- Departments Backup  
-- See: departments.json

-- Roles Backup
-- See: roles.json
  `
  
  fs.writeFileSync(
    path.join(backupDir, 'README.md'),
    `# Database Backup - ${timestamp}\n\n` +
    `This backup was created before resetting the departments setup.\n\n` +
    `## Files:\n` +
    `- user_profiles.json: User profile data\n` +
    `- departments.json: Department data (if exists)\n` +
    `- roles.json: Role data\n\n` +
    `## To Restore:\n` +
    `1. Review the JSON files\n` +
    `2. Use Supabase SQL Editor or API to restore data if needed\n`
  )
  
  console.log(`\n✅ Backup complete!`)
  console.log(`📁 Location: ${backupDir}`)
  console.log(`\n📋 Next steps:`)
  console.log(`   1. Review the backup files`)
  console.log(`   2. Run the clean setup migration`)
  console.log(`   3. Restore data if needed`)
  
  return backupDir
}

backupDatabase().catch(console.error)






