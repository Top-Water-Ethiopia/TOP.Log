import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { adminSupabase } from "@/lib/supabase/admin"
import { getEffectivePermissionsForUser } from "@/lib/rbac/server"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const { data: profile, error: profileError } = await adminSupabase
      .from("user_profiles")
      .select("role_id")
      .eq("user_id", user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 })
    }

    const roleId = profile.role_id

    const { data: role, error: roleErr } = await adminSupabase
      .from("roles")
      .select("id, name, level")
      .eq("id", roleId)
      .single()

    if (roleErr || !role) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 })
    }

    const effectivePermissions = await getEffectivePermissionsForUser(user.id)

    return NextResponse.json({
      role,
      permissions: effectivePermissions.globalPermissions,
      globalPermissions: effectivePermissions.globalPermissions,
      departmentAccess: effectivePermissions.departmentAccess,
    })
  } catch (error) {
    console.error("RBAC me API error:", error)
    return NextResponse.json(
      {
        error: "Failed to load RBAC data",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
