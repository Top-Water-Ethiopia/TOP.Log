#!/usr/bin/env ts-node
import { createClient } from "@supabase/supabase-js"
import "dotenv/config"

// Environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000001" // Admin role ID
const USER_ROLE_ID = "00000000-0000-0000-0000-000000000002" // Standard user role ID

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Missing required environment variables")
  console.error("Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file")
  process.exit(1)
}

const USER_EMAIL = process.argv[2]

if (!USER_EMAIL) {
  console.error("❌ Please provide a user email as an argument")
  console.log("\nUsage: ts-node scripts/set-admin.ts user@example.com")
  process.exit(1)
}

async function setAdmin() {
  try {
    console.log(`🔍 Setting up admin access for ${USER_EMAIL}...`)

    // Initialize admin client with service role key (bypasses RLS)
    const adminSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    })

    // 1. Get user by email
    console.log("\n1. Looking up user...")
    const {
      data: { users },
      error: listError,
    } = await adminSupabase.auth.admin.listUsers()

    if (listError) {
      throw new Error(`Failed to list users: ${listError.message}`)
    }

    const user = users.find((u) => u.email === USER_EMAIL)
    if (!user) {
      throw new Error(`No user found with email: ${USER_EMAIL}`)
    }
    console.log(`✅ Found user: ${user.email} (${user.id})`)

    // 2. Check if user already has an admin role
    console.log("\n2. Checking current role...")
    const { data: profile, error: profileError } = await adminSupabase
      .from("user_profiles")
      .select("role_id, name, department")
      .eq("user_id", user.id)
      .single()

    if (profileError && profileError.code !== "PGRST116") {
      throw new Error(`Failed to check user profile: ${profileError.message}`)
    }

    if (profile) {
      console.log("📋 Current profile:")
      console.log(`   - Role ID: ${profile.role_id}`)
      console.log(`   - Name: ${profile.name || "N/A"}`)
      console.log(`   - Department: ${profile.department || "N/A"}\n`)

      // Skip if already an admin
      if (profile.role_id === ADMIN_ROLE_ID) {
        console.log("ℹ️ User is already an admin. No changes needed.")
        process.exit(0)
      }

      // Update existing profile to admin
      console.log("🔄 Updating user to admin role...")
      const { error: updateError } = await adminSupabase
        .from("user_profiles")
        .update({
          role_id: ADMIN_ROLE_ID,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id)

      if (updateError) {
        throw new Error(`Failed to update user profile: ${updateError.message}`)
      }
    } else {
      // Create new admin profile
      console.log("📝 Creating new admin profile...")
      const { error: createError } = await adminSupabase.from("user_profiles").insert({
        user_id: user.id,
        role_id: ADMIN_ROLE_ID,
        name: user.user_metadata?.full_name || user.email?.split("@")[0] || "Admin User",
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

      if (createError) {
        throw new Error(`Failed to create admin profile: ${createError.message}`)
      }
    }

    console.log("\n✅ Success! User has been granted admin access.")
    console.log("\n💡 Next steps:")
    console.log("   1. User should log out and log back in for changes to take effect")
    console.log("   2. Visit /admin to access the admin dashboard")
    console.log("   3. User has been granted full admin privileges")
    console.log("\n🔒 Note: System now only uses two roles:")
    console.log(`   - Admin (${ADMIN_ROLE_ID})`)
    console.log(`   - User (${USER_ROLE_ID})`)
  } catch (error: any) {
    console.error("\n❌ Error:", error.message)
    console.error("\nStack trace:", error.stack)
    process.exit(1)
  }
}

// Run the script
setAdmin().catch(console.error)
