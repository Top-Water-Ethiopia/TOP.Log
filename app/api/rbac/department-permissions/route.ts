import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const url = new URL(request.url)
    const departmentId = url.searchParams.get("departmentId")

    if (!departmentId) {
      return NextResponse.json({ error: "departmentId is required" }, { status: 400 })
    }

    // Get user's active membership for this department (specifically access_level for permissions)
    const { data: membership, error: membershipError } = await supabase
      .from("user_department_memberships")
      .select(
        `
        role_id,
        role:roles(id, name, level)
      `
      )
      .eq("user_id", user.id)
      .eq("department_id", departmentId)
      .eq("membership_type", "access_level")
      .eq("is_active", true)
      .maybeSingle()

    if (membershipError) {
      console.error("Error fetching user membership:", membershipError)
      return NextResponse.json({ error: "Failed to fetch user membership" }, { status: 500 })
    }

    if (!membership) {
      return NextResponse.json({ permissions: [] })
    }

    // Get ALL permissions for the role
    const { data: permissions, error: permError } = await supabase
      .from("role_permissions")
      .select("resource, action, effect")
      .eq("role_id", membership.role_id)

    if (permError) {
      console.error("Error fetching permissions:", permError)
      return NextResponse.json({ error: "Failed to fetch permissions" }, { status: 500 })
    }

    // Return structured permissions with effects for client-side resolution
    const permissionMap: Record<string, "allow" | "deny" | "none"> = {}

    type PermissionRow = {
      effect: string
      permission_definition: {
        resource: string
        action: string
      } | null
    }

    const typedPermissions = permissions as unknown as Array<{ resource: string; action: string; effect: string }> | null
    typedPermissions?.forEach((p) => {
      const key = `${p.resource}.${p.action}`
      permissionMap[key] = p.effect as "allow" | "deny" | "none"
    })

    const roleData = Array.isArray(membership.role) ? membership.role[0] : membership.role

    return NextResponse.json({
      permissions: permissionMap,
      accessLevel: roleData,
    })
  } catch (error) {
    console.error("Error in department permissions API:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
