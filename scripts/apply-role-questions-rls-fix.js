// Apply RLS fix for role_questions using service role to bypass restrictions

const { createClient } = require("@supabase/supabase-js")
require("dotenv").config({ path: ".env.local" })
require("dotenv").config({ path: ".env" })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error("❌ Missing required environment variables:")
  console.error("   - NEXT_PUBLIC_SUPABASE_URL")
  console.error("   - SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

// The SQL to apply (from QUICK_FIX_ROLE_QUESTIONS_RLS.sql)
const fixSQL = `
-- QUICK FIX: Apply RLS policies for role_questions to allow super admin access

BEGIN;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view questions for their role" ON role_questions;
DROP POLICY IF EXISTS "Admins can view all role questions" ON role_questions;
DROP POLICY IF EXISTS "Admins can create role questions" ON role_questions;
DROP POLICY IF EXISTS "Admins can update role questions" ON role_questions;
DROP POLICY IF EXISTS "Admins can delete role questions" ON role_questions;

-- Regular users can view active questions for their role
CREATE POLICY "Users can view questions for their role"
  ON role_questions FOR SELECT
  TO authenticated
  USING (
    is_active = true AND
    role_id IN (
      SELECT role_id FROM user_profiles WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Admins and super admins can view ALL questions
CREATE POLICY "Admins can view all role questions"
  ON role_questions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND (role_id = '00000000-0000-0000-0000-000000000001'::UUID -- Admin
           OR role_id = '00000000-0000-0000-0000-000000000000'::UUID) -- Super Admin
      AND is_active = true
    )
  );

-- Admins and super admins can create questions
CREATE POLICY "Admins can create role questions"
  ON role_questions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND (role_id = '00000000-0000-0000-0000-000000000001'::UUID -- Admin
           OR role_id = '00000000-0000-0000-0000-000000000000'::UUID) -- Super Admin
      AND is_active = true
    )
  );

-- Admins and super admins can update questions
CREATE POLICY "Admins can update role questions"
  ON role_questions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND (role_id = '00000000-0000-0000-0000-000000000001'::UUID -- Admin
           OR role_id = '00000000-0000-0000-0000-000000000000'::UUID) -- Super Admin
      AND is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND (role_id = '00000000-0000-0000-0000-000000000001'::UUID -- Admin
           OR role_id = '00000000-0000-0000-0000-000000000000'::UUID) -- Super Admin
      AND is_active = true
    )
  );

-- Admins and super admins can delete questions
CREATE POLICY "Admins can delete role questions"
  ON role_questions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND (role_id = '00000000-0000-0000-0000-000000000001'::UUID -- Admin
           OR role_id = '00000000-0000-0000-0000-000000000000'::UUID) -- Super Admin
      AND is_active = true
    )
  );

COMMIT;
`

async function applyFix() {
  console.log("🚀 Applying RLS fix for role_questions...\n")

  try {
    // Execute the full SQL using REST API with service role
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ sql: fixSQL }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    console.log("✅ RLS fix applied successfully!")
    console.log("\n🔧 Next: Retest the INSERT operation to the role_questions table.")
  } catch (error) {
    console.error("❌ Error applying fix:", error.message)
    console.error("\n💡 Manual alternative:")
    console.error("1. Go to Supabase Dashboard → SQL Editor")
    console.error("2. Paste the SQL below and run it:")
    console.log(fixSQL)
    process.exit(1)
  }
}

applyFix()
