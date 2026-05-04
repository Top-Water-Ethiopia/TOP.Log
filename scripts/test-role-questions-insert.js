const { createClient } = require("@supabase/supabase-js")
require("dotenv").config({ path: ".env.local" })
require("dotenv").config({ path: ".env" })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("❌ Missing required environment variables:")
  console.error("   - NEXT_PUBLIC_SUPABASE_URL")
  console.error("   - NEXT_PUBLIC_SUPABASE_ANON_KEY")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testInsert() {
  console.log("🧪 Testing INSERT into role_questions...\n")

  try {
    // Sign in as the user (assuming we have password or use service for test, but for RLS test, need auth)
    // For testing, we'll assume the session is active or sign in. But to simulate, use anon but set session.
    // Better: use admin client to get JWT or assume user is logged in.

    // To test as authenticated user, we need to sign in.
    // Using the email and password - but password not known. Assume service role for check, but for RLS, need user session.
    // For this test, let's use the anon key, but that won't have auth.uid().

    // Alternative: Use the payload provided in the task to test the insert with service role to see if policy allows, but service role bypasses RLS.

    // To properly test RLS, we need to create a temporary user with super admin role, sign in, then insert.

    const {
      data: { session },
      error: signInError,
    } = await supabase.auth.signInWithPassword({
      email: "contact.samuelerbo@gmail.com", // Assume this is the super admin email
      password: "your-password-here", // User needs to replace with actual
    })

    if (signInError || !session) {
      console.log("⚠️  Failed to sign in - replace with actual credentials")
      console.log("   Error:", signInError?.message)
      return
    }

    console.log("✅ Signed in as super admin")

    // Now test insert the payload from the task
    const testPayload = {
      role_id: "00000000-0000-0000-0000-000000000003",
      question_key: "hum_123",
      question_label: "Ut officiis nemo est",
      question_type: "text",
      question_description: "Eos quaerat providen",
      placeholder: "Minim voluptatem iur",
      options: null,
      is_required: false,
      display_order: 0,
      validation_rules: null,
      is_active: true,
      created_by: "ccb4613c-3e6d-4421-8b1c-3277280d658c",
    }

    const { data, error: insertError } = await supabase.from("role_questions").insert(testPayload).select().single()

    if (insertError) {
      console.error("❌ Insert failed:", insertError.message)
      console.error("   Code:", insertError.code)
      console.error("   Details:", insertError.details)
      if (insertError.code === "42501") {
        console.log("   This is RLS violation - policies need fixing")
      }
    } else {
      console.log("✅ Insert succeeded!")
      console.log("   New question ID:", data.id)
      // Clean up - delete the test row
      await supabase.from("role_questions").delete().eq("id", data.id)
      console.log("   Test row cleaned up.")
    }

    // Sign out
    await supabase.auth.signOut()
    console.log("✅ Test completed.")
  } catch (err) {
    console.error("❌ Unexpected error:", err.message)
  }
}
