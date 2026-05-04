import { NextResponse } from "next/server"
import { adminSupabase } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"

// Enable dynamic route behavior
export const dynamic = "force-dynamic"

const ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000001"
const SYSTEM_ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000010"

// Helper to verify admin or super admin access
async function verifyAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { isAdmin: false, error: "Not authenticated" }
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("role_id")
    .eq("user_id", user.id)
    .single()

  if (profileError || !profile) {
    return { isAdmin: false, error: "Admin access required" }
  }

  const isAdmin = profile.role_id === ADMIN_ROLE_ID || profile.role_id === SYSTEM_ADMIN_ROLE_ID

  if (!isAdmin) {
    return { isAdmin: false, error: "Admin access required" }
  }

  return { isAdmin: true, userId: user.id }
}

export async function POST(request: Request) {
  try {
    // Verify admin access
    const { isAdmin, error: authError } = await verifyAdmin()
    if (!isAdmin) {
      return NextResponse.json({ error: authError || "Admin access required" }, { status: 403 })
    }

    const body = await request.json()
    const { user_id, email, mode, password } = body

    if (!user_id) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    if (mode === "email") {
      if (!email) {
        return NextResponse.json({ error: "Email is required for email reset mode" }, { status: 400 })
      }

      // Send password reset email using regular Supabase client
      // This uses the anon key which has permission to send reset emails
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        return NextResponse.json({ error: "Supabase configuration missing" }, { status: 500 })
      }

      const supabaseClient = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      )

      const siteUrl =
        process.env.NEXT_PUBLIC_SITE_URL ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")

      const { error: resetError } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: `${siteUrl}/update-password`,
      })

      if (resetError) {
        console.error("Error sending password reset email:", resetError)
        return NextResponse.json(
          { error: "Failed to send password reset email", message: resetError.message },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        message: "Password reset email sent successfully",
      })
    } else if (mode === "direct") {
      // Set new password directly
      if (!password) {
        return NextResponse.json({ error: "Password is required for direct reset" }, { status: 400 })
      }

      if (password.length < 8) {
        return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 })
      }

      // Update user password using admin client
      const { error: updateError } = await adminSupabase.auth.admin.updateUserById(user_id, {
        password: password,
      })

      if (updateError) {
        console.error("Error updating user password:", updateError)
        return NextResponse.json({ error: "Failed to update password", message: updateError.message }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: "Password reset successfully",
      })
    } else {
      return NextResponse.json({ error: 'Invalid mode. Must be "email" or "direct"' }, { status: 400 })
    }
  } catch (error) {
    console.error("Admin reset password API error:", error)
    return NextResponse.json(
      {
        error: "Failed to reset password",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
