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

    // Get user's access level for this department
    const { data: userAccess, error: accessError } = await supabase
      .from("user_department_access_levels")
      .select(
        `
        access_level_id,
        access_level:department_access_levels(id, name, level)
      `
      )
      .eq("user_id", user.id)
      .eq("department_id", departmentId)
      .maybeSingle()

    if (accessError) {
      console.error("Error fetching user access level:", accessError)
      return NextResponse.json({ error: "Failed to fetch user access level" }, { status: 500 })
    }

    if (!userAccess) {
      return NextResponse.json({ permissions: [] })
    }

    // Get ALL permissions for the user's access level via permission_definitions
    const { data: permissions, error: permError } = await supabase
      .from("department_access_level_permissions")
      .select("effect, permission_definition:permission_definitions(resource, action)")
      .eq("access_level_id", userAccess.access_level_id)

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

    const typedPermissions = permissions as unknown as PermissionRow[] | null
    typedPermissions?.forEach((p) => {
      if (p.permission_definition) {
        const key = `${p.permission_definition.resource}.${p.permission_definition.action}`
        permissionMap[key] = p.effect as "allow" | "deny" | "none"
      }
    })

    return NextResponse.json({
      permissions: permissionMap,
      accessLevel: userAccess.access_level,
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
