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

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

async function diagnoseUserRole() {
  console.log("🔍 Diagnosing user role for the INSERT operation...\n")

  const userId = "ccb4613c-3e6d-4421-8b1c-3277280d658c" // From the payload created_by

  try {
    // Query user_profiles for this user to check role and status
    const { data: profile, error } = await supabase
      .from("user_profiles")
      .select("user_id, role_id, is_active")
      .eq("user_id", userId)
      .single()

    if (error) {
      console.error("❌ Error querying user profile:", error.message)
      return
    }

    if (!profile) {
      console.log("❌ No profile found for user:", userId)
      console.log("The user may not have a profile, which could cause RLS violations.")
      return
    }

    console.log("📋 User Profile Details:")
    console.log("   User ID:", profile.user_id)
    console.log("   Role ID:", profile.role_id)
    console.log("   Is Active:", profile.is_active)
    console.log("   Email: Not set (from auth.users)")

    // Check against admin/super admin roles
    const adminRole = "00000000-0000-0000-0000-000000000001"
    const superAdminRole = "00000000-0000-0000-0000-000000000000"

    const isAdminOrSuper = profile.role_id === adminRole || profile.role_id === superAdminRole
    const isActive = profile.is_active

    console.log("\n📊 RLS Access Analysis:")
    console.log("   Can Insert into role_questions:", isAdminOrSuper && isActive ? "✅ YES" : "❌ NO")

    if (!isAdminOrSuper) {
      console.log("   ❌ Reason: User role is not Admin or Super Admin")
      console.log("   Fix: Update user_profiles set role_id to admin/super admin role for this user")
    }

    if (!isActive) {
      console.log("   ❌ Reason: User profile is not active")
      console.log("   Fix: Update user_profiles set is_active = true")
    }

    // Also check the policies briefly (print SQL to run)
    console.log("\n🔧 To verify policies, run this in Supabase SQL Editor:")
    console.log("SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'role_questions';")
  } catch (err) {
    console.error("❌ Unexpected error:", err)
  }
}

diagnoseUserRole()
