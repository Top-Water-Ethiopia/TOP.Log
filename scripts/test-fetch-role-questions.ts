/**
 * Script to test fetching role questions directly
 * This will help diagnose why questions aren't showing in the UI
 */

import * as dotenv from "dotenv"
import * as path from "path"

const projectRoot = process.cwd()
dotenv.config({ path: path.resolve(projectRoot, ".env.local") })
dotenv.config({ path: path.resolve(projectRoot, ".env") })

async function runScript() {
  const { adminSupabase } = await import("../lib/supabase/admin")
  const { supabase } = await import("../lib/supabase/client")

  const ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000001"
  const USER_EMAIL = "contact.samuelerbo@gmail.com"

  console.log("🔍 Testing Role Questions Fetch\n")
  console.log("=".repeat(60))

  try {
    // 1. Get the user
    console.log("\n1️⃣ Getting user...")
    const {
      data: { users },
      error: listError,
    } = await adminSupabase.auth.admin.listUsers()

    if (listError) {
      throw new Error(`Failed to list users: ${listError.message}`)
    }

    const user = users.find((u) => u.email === USER_EMAIL)
    if (!user) {
      throw new Error(`User with email ${USER_EMAIL} not found`)
    }

    console.log(`✅ User found: ${user.email} (${user.id})`)

    // 2. Get user's profile to check role
    console.log("\n2️⃣ Getting user profile...")
    const { data: profile, error: profileError } = await adminSupabase
      .from("user_profiles")
      .select("*")
      .eq("user_id", user.id)
      .single()

    if (profileError) {
      throw new Error(`Failed to fetch user profile: ${profileError.message}`)
    }

    // 3. Get roles and questions with admin client (bypasses RLS)
    console.log("\n3️⃣ Fetching roles and questions (admin client)...")
    const { data: rolesAdmin, error: rolesAdminError } = await adminSupabase.from("roles").select("*")

    if (rolesAdminError) {
      console.error("❌ Error fetching roles (admin):", rolesAdminError.message)
    } else {
      console.log(`✅ Fetched ${rolesAdmin?.length || 0} roles (admin client)`)
    }

    const { data: questionsAdmin, error: questionsAdminError } = await adminSupabase.from("role_questions").select("*")

    if (questionsAdminError) {
      console.error("❌ Error fetching questions (admin):", questionsAdminError.message)
    } else {
      console.log(`✅ Fetched ${questionsAdmin?.length || 0} questions (admin client)`)
    }

    console.log(`✅ Profile found:`)
    console.log(`   - Role ID: ${profile.role_id}`)
    console.log(`   - Name: ${profile.name}`)
    console.log(`   - Is Active: ${profile.is_active}`)

    // 4. Try to fetch roles with RLS (should be restricted)
    console.log("\n4️⃣ Testing RLS for roles...")
    const { data: rolesRLS, error: rolesRLSError } = await supabase.from("roles").select("*")

    if (rolesRLSError) {
      console.log("❌ RLS blocked access to roles (expected for non-admins):", rolesRLSError.message)
    } else {
      console.log("✅ RLS allowed access to roles (this might be unexpected)")
      console.log(`   Found ${rolesRLS?.length || 0} roles`)
    }

    // 5. Try to fetch questions with RLS (should be restricted)
    console.log("\n5️⃣ Testing RLS for role questions...")
    const { data: questionsRLS, error: questionsRLSError } = await supabase.from("role_questions").select("*")

    if (questionsRLSError) {
      console.log("❌ RLS blocked access to questions (expected for non-admins):", questionsRLSError.message)
    } else {
      console.log("✅ RLS allowed access to questions (this might be unexpected)")
      console.log(`   Found ${questionsRLS?.length || 0} questions`)
    }

    // 6. Check policies directly
    console.log("\n6️⃣ Checking policies...")
    try {
      const { data: policies, error: policiesError } = await adminSupabase
        .from("pg_policies")
        .select("*")
        .in("tablename", ["roles", "role_questions"])

      if (policiesError) {
        console.log("⚠️  Could not check policies directly")
        console.log("💡 Check policies in Supabase Dashboard → Authentication → Policies")
      } else {
        console.log(`✅ Found ${policies?.length || 0} policies`)
      }
    } catch (error) {
      console.log("⚠️  Could not check policies directly")
      console.log("💡 Check policies in Supabase Dashboard → Authentication → Policies")
    }

    // Summary
    console.log("\n" + "=".repeat(60))
    console.log("📊 SUMMARY")
    console.log("=".repeat(60))
    console.log(`User Role: ${profile.role_id === ADMIN_ROLE_ID ? "Admin ✅" : "Other ❌"}`)
    console.log(`Roles (Admin): ${rolesAdmin?.length || 0}`)
    console.log(`Questions (Admin): ${questionsAdmin?.length || 0}`)

    if (rolesRLS) {
      console.log(`Roles (RLS): ${rolesRLS.length}`)
    }

    if (questionsRLS) {
      console.log(`Questions (RLS): ${questionsRLS.length}`)
    }

    if (questionsAdmin && questionsAdmin.length > 0 && questionsRLS && questionsRLS.length === 0) {
      console.log("\n⚠️  ISSUE DETECTED: Questions exist but RLS is blocking access!")
      console.log("💡 Solution: Apply the RLS migration to fix policies")
    }
  } catch (error: any) {
    console.error("\n❌ Error:", error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

runScript().catch(console.error)
