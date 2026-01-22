import { NextResponse } from "next/server"
import { adminSupabase } from "@/lib/supabase/admin"
import { verifyPermissionFromRequest } from "@/lib/rbac/server"

export const dynamic = "force-dynamic"

export async function GET(request: Request, { params }: { params: Promise<{ departmentId: string }> }) {
  try {
    const auth = await verifyPermissionFromRequest(request, "admin.system")
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { departmentId } = await params

    const { data: rows, error } = await adminSupabase
      .from("department_role_permissions")
      .select("department_role")
      .eq("department_id", departmentId)
      .eq("resource", "department_questions")
      .eq("action", "answer")
      .limit(10000)

    if (error) {
      return NextResponse.json({ error: "Failed to load access control", message: error.message }, { status: 500 })
    }

    const allowedRoles = (rows || [])
      .map((r) => (typeof r?.department_role === "string" ? r.department_role : null))
      .filter((r): r is string => typeof r === "string" && r.length > 0)

    return NextResponse.json({ data: { allowedRoles } })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to load access control", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ departmentId: string }> }) {
  try {
    const auth = await verifyPermissionFromRequest(request, "admin.system")
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { departmentId } = await params
    const body = await request.json().catch(() => ({}))

    const allowedRolesRaw = body.allowedRoles
    if (!Array.isArray(allowedRolesRaw)) {
      return NextResponse.json({ error: "allowedRoles must be an array" }, { status: 400 })
    }

    const allowedRoles = Array.from(new Set(allowedRolesRaw.filter((r: unknown): r is string => typeof r === "string")))

    if (allowedRoles.length > 0) {
      const { data: validRows, error: rolesError } = await adminSupabase
        .from("department_roles")
        .select("key")
        .in("key", allowedRoles)
        .eq("is_active", true)
        .limit(10000)

      if (rolesError) {
        return NextResponse.json({ error: "Failed to validate roles", message: rolesError.message }, { status: 500 })
      }

      const validKeys = new Set((validRows || []).map((r) => r.key))
      const invalid = allowedRoles.filter((r) => !validKeys.has(r))
      if (invalid.length > 0) {
        return NextResponse.json(
          { error: `Invalid Department Access Control role(s): ${invalid.join(", ")}` },
          { status: 400 }
        )
      }
    }

    const { data: existingRows, error: existingError } = await adminSupabase
      .from("department_role_permissions")
      .select("id, department_role")
      .eq("department_id", departmentId)
      .eq("resource", "department_questions")
      .eq("action", "answer")
      .limit(10000)

    if (existingError) {
      return NextResponse.json(
        { error: "Failed to load existing grants", message: existingError.message },
        { status: 500 }
      )
    }

    const existingRoles = new Set(
      (existingRows || [])
        .map((r) => (typeof r?.department_role === "string" ? r.department_role : null))
        .filter((r): r is string => typeof r === "string" && r.length > 0)
    )

    const toAdd = allowedRoles.filter((r) => !existingRoles.has(r))
    const toRemove = Array.from(existingRoles).filter((r) => !allowedRoles.includes(r))

    if (toRemove.length > 0) {
      const { error: deleteError } = await adminSupabase
        .from("department_role_permissions")
        .delete()
        .eq("department_id", departmentId)
        .eq("resource", "department_questions")
        .eq("action", "answer")
        .in("department_role", toRemove)

      if (deleteError) {
        return NextResponse.json({ error: "Failed to remove grants", message: deleteError.message }, { status: 500 })
      }
    }

    if (toAdd.length > 0) {
      const { error: insertError } = await adminSupabase.from("department_role_permissions").insert(
        toAdd.map((department_role) => ({
          department_id: departmentId,
          department_role,
          resource: "department_questions",
          action: "answer",
          created_by: auth.userId,
          updated_by: auth.userId,
          updated_at: new Date().toISOString(),
        }))
      )

      if (insertError) {
        return NextResponse.json({ error: "Failed to add grants", message: insertError.message }, { status: 500 })
      }
    }

    return NextResponse.json({ data: { allowedRoles } })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update access control", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
