import { NextResponse } from "next/server"
import { adminSupabase } from "@/lib/supabase/admin"
import { verifyPermissionFromRequest } from "@/lib/rbac/server"

export const dynamic = "force-dynamic"

type DepartmentRoleRow = {
  key: string
  label: string
  sort_order: number
  is_active: boolean
  is_default: boolean
}

type DepartmentRoleUpdate = {
  key?: string
  label?: string
  sort_order?: number
  is_active?: boolean
  is_default?: boolean
  updated_at?: string
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function normalizeRoleKey(raw: unknown) {
  if (typeof raw !== "string") return null
  const key = raw.trim()
  if (!key) return null
  if (!/^[a-z0-9_]+$/.test(key)) return null
  return key
}

function normalizeLabel(raw: unknown) {
  if (typeof raw !== "string") return null
  const label = raw.trim()
  if (!label) return null
  return label
}

export async function GET(request: Request) {
  const auth = await verifyPermissionFromRequest(request, "admin.system")
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { data, error } = await adminSupabase
    .from("department_roles")
    .select("key, label, sort_order, is_active, is_default")
    .order("sort_order", { ascending: true })
    .order("key", { ascending: true })

  if (error) {
    return NextResponse.json({ error: "Failed to load department roles", message: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: (data || []) as unknown as DepartmentRoleRow[] })
}

export async function POST(request: Request) {
  const auth = await verifyPermissionFromRequest(request, "admin.system")
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const rawBody = await request.json().catch(() => ({}))
  const body = asObject(rawBody)

  const key = normalizeRoleKey(body.key)
  const label = normalizeLabel(body.label)
  const sort_order = Number.isFinite(Number(body.sort_order)) ? Number(body.sort_order) : 0
  const is_active = body.is_active !== false
  const is_default = body.is_default === true

  if (!key) {
    return NextResponse.json({ error: "Invalid key" }, { status: 400 })
  }
  if (!label) {
    return NextResponse.json({ error: "Invalid label" }, { status: 400 })
  }

  if (is_default) {
    const { error: unsetError } = await adminSupabase
      .from("department_roles")
      .update({ is_default: false, updated_at: new Date().toISOString() })
      .eq("is_default", true)

    if (unsetError) {
      return NextResponse.json(
        { error: "Failed to update department roles", message: unsetError.message },
        { status: 500 }
      )
    }
  }

  const { data, error } = await adminSupabase
    .from("department_roles")
    .insert({
      key,
      label,
      sort_order,
      is_active,
      is_default,
      updated_at: new Date().toISOString(),
    })
    .select("key, label, sort_order, is_active, is_default")
    .single()

  if (error) {
    return NextResponse.json({ error: "Failed to create department role", message: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: data as unknown as DepartmentRoleRow }, { status: 201 })
}

export async function PUT(request: Request) {
  const auth = await verifyPermissionFromRequest(request, "admin.system")
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const rawBody = await request.json().catch(() => ({}))
  const body = asObject(rawBody)

  const key = normalizeRoleKey(body.key)
  if (!key) {
    return NextResponse.json({ error: "key is required" }, { status: 400 })
  }

  const updates: DepartmentRoleUpdate = {
    updated_at: new Date().toISOString(),
  }

  if (body.label !== undefined) {
    const label = normalizeLabel(body.label)
    if (!label) {
      return NextResponse.json({ error: "Invalid label" }, { status: 400 })
    }
    updates.label = label
  }

  if (body.sort_order !== undefined) {
    const v = Number(body.sort_order)
    if (!Number.isFinite(v)) {
      return NextResponse.json({ error: "Invalid sort_order" }, { status: 400 })
    }
    updates.sort_order = v
  }

  if (body.is_active !== undefined) {
    updates.is_active = body.is_active !== false
  }

  if (body.is_default !== undefined) {
    updates.is_default = body.is_default === true
  }

  if (updates.is_default === true) {
    const { error: unsetError } = await adminSupabase
      .from("department_roles")
      .update({ is_default: false, updated_at: new Date().toISOString() })
      .eq("is_default", true)
      .neq("key", key)

    if (unsetError) {
      return NextResponse.json(
        { error: "Failed to update department roles", message: unsetError.message },
        { status: 500 }
      )
    }
  }

  const { data, error } = await adminSupabase
    .from("department_roles")
    .update(updates)
    .eq("key", key)
    .select("key, label, sort_order, is_active, is_default")
    .single()

  if (error) {
    return NextResponse.json({ error: "Failed to update department role", message: error.message }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ error: "Department role not found" }, { status: 404 })
  }

  return NextResponse.json({ data: data as unknown as DepartmentRoleRow })
}

export async function DELETE(request: Request) {
  const auth = await verifyPermissionFromRequest(request, "admin.system")
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const url = new URL(request.url)
  const key = normalizeRoleKey(url.searchParams.get("key"))
  if (!key) {
    return NextResponse.json({ error: "key is required" }, { status: 400 })
  }

  const { data: existing, error: existingError } = await adminSupabase
    .from("department_roles")
    .select("key, is_default")
    .eq("key", key)
    .maybeSingle()

  if (existingError) {
    return NextResponse.json(
      { error: "Failed to load department role", message: existingError.message },
      { status: 500 }
    )
  }

  if (!existing) {
    return NextResponse.json({ data: { deleted: false } })
  }

  const existingRow = existing as unknown as { key: string; is_default: boolean }

  if (existingRow.is_default) {
    return NextResponse.json({ error: "Cannot delete the default role" }, { status: 409 })
  }

  // Check if any users are assigned to this role
  const { data: userAssignments, error: assignmentError } = await adminSupabase
    .from("user_department_roles")
    .select("user_id, department_id")
    .eq("role", key)
    .limit(1)

  if (assignmentError) {
    return NextResponse.json(
      { error: "Failed to check user assignments", message: assignmentError.message },
      { status: 500 }
    )
  }

  if (userAssignments && userAssignments.length > 0) {
    return NextResponse.json(
      {
        error: "Cannot delete department role",
        message: "This role is still assigned to users. Please reassign all users to another role before deleting.",
        hasAssignments: true,
        assignmentCount: userAssignments.length,
      },
      { status: 409 }
    )
  }

  const { error } = await adminSupabase.from("department_roles").delete().eq("key", key)
  if (error) {
    return NextResponse.json({ error: "Failed to delete department role", message: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: { deleted: true } })
}
