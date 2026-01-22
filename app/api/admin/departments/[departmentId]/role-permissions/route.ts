import { NextResponse } from "next/server"
import { adminSupabase } from "@/lib/supabase/admin"
import { verifyPermissionFromRequest } from "@/lib/rbac/server"

export const dynamic = "force-dynamic"

function normalizeName(raw: unknown) {
  if (typeof raw !== "string") return null
  const v = raw.trim().toLowerCase()
  if (!v) return null
  if (/\s/.test(v)) return null
  return v
}

async function validateDepartmentRole(role: string) {
  const { data, error } = await adminSupabase
    .from("department_roles")
    .select("key, is_active")
    .eq("key", role)
    .maybeSingle()

  if (error) {
    return { ok: false as const, error: "Failed to validate department role", message: error.message }
  }

  if (!data) {
    return { ok: false as const, error: "Invalid department role" }
  }

  return { ok: true as const, isActive: !!data.is_active }
}

export async function GET(request: Request, { params }: { params: Promise<{ departmentId: string }> }) {
  try {
    const auth = await verifyPermissionFromRequest(request, "admin.system")
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { departmentId } = await params
    if (!departmentId) {
      return NextResponse.json({ error: "departmentId is required" }, { status: 400 })
    }

    const { data, error } = await adminSupabase
      .from("department_role_permissions")
      .select("id, department_id, department_role, resource, action, created_at, updated_at")
      .eq("department_id", departmentId)
      .order("resource", { ascending: true })
      .order("action", { ascending: true })
      .order("department_role", { ascending: true })
      .limit(10000)

    if (error) {
      return NextResponse.json({ error: "Failed to load role permissions", message: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: data || [] })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to load role permissions", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ departmentId: string }> }) {
  try {
    const auth = await verifyPermissionFromRequest(request, "admin.system")
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { departmentId } = await params
    if (!departmentId) {
      return NextResponse.json({ error: "departmentId is required" }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))

    const department_role = normalizeName(body.department_role)
    const resource = normalizeName(body.resource)
    const action = normalizeName(body.action)

    if (!department_role) {
      return NextResponse.json({ error: "department_role is required" }, { status: 400 })
    }
    if (!resource) {
      return NextResponse.json({ error: "resource is required" }, { status: 400 })
    }
    if (!action) {
      return NextResponse.json({ error: "action is required" }, { status: 400 })
    }

    const roleCheck = await validateDepartmentRole(department_role)
    if (!roleCheck.ok) {
      return NextResponse.json({ error: roleCheck.error, message: roleCheck.message }, { status: 400 })
    }

    if (!roleCheck.isActive) {
      return NextResponse.json({ error: "Department role is not active" }, { status: 400 })
    }

    const { data, error } = await adminSupabase
      .from("department_role_permissions")
      .insert({
        department_id: departmentId,
        department_role,
        resource,
        action,
        created_by: auth.userId,
        updated_by: auth.userId,
        updated_at: new Date().toISOString(),
      })
      .select("id, department_id, department_role, resource, action, created_at, updated_at")
      .single()

    if (error) {
      const status = error.code === "23505" ? 409 : 500
      return NextResponse.json({ error: "Failed to create role permission", message: error.message }, { status })
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create role permission", message: error instanceof Error ? error.message : "Unknown error" },
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
    if (!departmentId) {
      return NextResponse.json({ error: "departmentId is required" }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))

    const id = typeof body.id === "string" ? body.id.trim() : null
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 })
    }

    const updates: {
      department_role?: string
      resource?: string
      action?: string
      updated_by: string
      updated_at: string
    } = {
      updated_by: auth.userId,
      updated_at: new Date().toISOString(),
    }

    if (body.department_role !== undefined) {
      const v = normalizeName(body.department_role)
      if (!v) {
        return NextResponse.json({ error: "Invalid department_role" }, { status: 400 })
      }
      const roleCheck = await validateDepartmentRole(v)
      if (!roleCheck.ok) {
        return NextResponse.json({ error: roleCheck.error, message: roleCheck.message }, { status: 400 })
      }

      if (!roleCheck.isActive) {
        return NextResponse.json({ error: "Department role is not active" }, { status: 400 })
      }
      updates.department_role = v
    }

    if (body.resource !== undefined) {
      const v = normalizeName(body.resource)
      if (!v) {
        return NextResponse.json({ error: "Invalid resource" }, { status: 400 })
      }
      updates.resource = v
    }

    if (body.action !== undefined) {
      const v = normalizeName(body.action)
      if (!v) {
        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
      }
      updates.action = v
    }

    const { data, error } = await adminSupabase
      .from("department_role_permissions")
      .update(updates)
      .eq("id", id)
      .eq("department_id", departmentId)
      .select("id, department_id, department_role, resource, action, created_at, updated_at")
      .maybeSingle()

    if (error) {
      const status = error.code === "23505" ? 409 : 500
      return NextResponse.json({ error: "Failed to update role permission", message: error.message }, { status })
    }

    if (!data) {
      return NextResponse.json({ error: "Role permission not found" }, { status: 404 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update role permission", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ departmentId: string }> }) {
  try {
    const auth = await verifyPermissionFromRequest(request, "admin.system")
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { departmentId } = await params
    if (!departmentId) {
      return NextResponse.json({ error: "departmentId is required" }, { status: 400 })
    }

    const url = new URL(request.url)
    const id = (url.searchParams.get("id") || "").trim()

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 })
    }

    const { error } = await adminSupabase
      .from("department_role_permissions")
      .delete()
      .eq("department_id", departmentId)
      .eq("id", id)

    if (error) {
      return NextResponse.json({ error: "Failed to delete role permission", message: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: { deleted: true } })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete role permission", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
