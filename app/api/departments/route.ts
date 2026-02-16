import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { adminSupabase } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check system-wide permissions
    const { data: profile } = await adminSupabase
      .from("user_profiles")
      .select("role_id")
      .eq("user_id", user.id)
      .single()

    let hasSystemWideAccess = false
    if (profile) {
      const { data: permissions } = await adminSupabase
        .from("permissions")
        .select("resource, action")
        .eq("role_id", profile.role_id)

      const permissionNames = permissions?.map((p) => `${p.resource}.${p.action}`) || []
      hasSystemWideAccess =
        permissionNames.includes("departments.read") ||
        permissionNames.includes("departments.own.read") ||
        permissionNames.includes("admin.system")
    }

    // Check department access levels (new architecture)
    const { data: accessLevels } = await supabase
      .from("user_department_access_levels")
      .select(
        `
        department_id,
        department:departments (
          id,
          name,
          description,
          is_active
        )
      `
      )
      .eq("user_id", user.id)

    // Filter to only include departments with active access
    const normalized = (accessLevels || [])
      .map((row: unknown) => {
        if (!row || typeof row !== "object") return null
        const r = row as Record<string, unknown>
        const dept = r.department as Record<string, unknown> | null | undefined
        if (!dept || typeof dept !== "object") return null
        const deptId = dept.id
        if (typeof deptId !== "string" || !deptId) return null
        return {
          department_id: String(r.department_id ?? ""),
          department: {
            id: deptId,
            name: String(dept.name ?? ""),
            description: (typeof dept.description === "string" ? dept.description : null) ?? null,
            is_active: Boolean(dept.is_active),
          },
        }
      })
      .filter(Boolean)

    // Return both system-wide access flag and department list
    return NextResponse.json({
      data: normalized,
      hasSystemWideAccess,
    })
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
