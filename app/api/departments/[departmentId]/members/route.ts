import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET(_request: Request, { params }: { params: Promise<{ departmentId: string }> }) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { departmentId } = await params

    if (!departmentId) {
      return NextResponse.json({ error: "Department ID is required" }, { status: 400 })
    }

    const { data: selfMembership, error: selfMembershipError } = await supabase
      .from("user_department_roles")
      .select("department_id")
      .eq("department_id", departmentId)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle()

    if (selfMembershipError) {
      return NextResponse.json(
        { error: "Failed to verify department membership", message: selfMembershipError.message },
        { status: 500 }
      )
    }

    if (!selfMembership) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const { data: memberships, error: membershipError } = await supabase
      .from("user_department_roles")
      .select("user_id, role, is_active")
      .eq("department_id", departmentId)
      .eq("is_active", true)
      .order("updated_at", { ascending: false })

    if (membershipError) {
      return NextResponse.json({ error: "Failed to load members", message: membershipError.message }, { status: 500 })
    }

    const userIds = Array.from(new Set((memberships || []).map((m) => m.user_id)))

    const { data: profiles, error: profilesError } = await supabase
      .from("user_profiles")
      .select("user_id, name, role_id, department_id, is_active")
      .in("user_id", userIds)

    if (profilesError) {
      return NextResponse.json(
        { error: "Failed to load member profiles", message: profilesError.message },
        { status: 500 }
      )
    }

    const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]))

    const merged = (memberships || []).map((m) => ({
      ...m,
      profile: profileMap.get(m.user_id) || null,
    }))

    return NextResponse.json({ data: merged })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
