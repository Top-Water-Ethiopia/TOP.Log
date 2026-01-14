import { NextResponse } from "next/server"
import { adminSupabase } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

const ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000001"
const SYSTEM_ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000010"

async function verifyAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { isAdmin: false as const, error: "Not authenticated" }
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("role_id")
    .eq("user_id", user.id)
    .single()

  if (profileError || !profile) {
    return { isAdmin: false as const, error: "Admin access required" }
  }

  const isAdmin = profile.role_id === ADMIN_ROLE_ID || profile.role_id === SYSTEM_ADMIN_ROLE_ID

  if (!isAdmin) {
    return { isAdmin: false as const, error: "Admin access required" }
  }

  return { isAdmin: true as const }
}

export async function GET() {
  try {
    const { isAdmin, error: authError } = await verifyAdmin()
    if (!isAdmin) {
      return NextResponse.json({ error: authError || "Admin access required" }, { status: 403 })
    }

    const { data: memberships, error } = await adminSupabase
      .from("user_department_roles")
      .select("user_id, department_id, is_active")
      .eq("is_active", true)

    if (error) {
      return NextResponse.json({ error: "Failed to load memberships", message: error.message }, { status: 500 })
    }

    const byUserId: Record<string, string[]> = {}
    for (const m of memberships || []) {
      const userId = (m as any).user_id as string | undefined
      const deptId = (m as any).department_id as string | undefined
      if (!userId || !deptId) continue
      if (!byUserId[userId]) byUserId[userId] = []
      if (!byUserId[userId].includes(deptId)) byUserId[userId].push(deptId)
    }

    return NextResponse.json({ data: byUserId })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to load memberships",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
