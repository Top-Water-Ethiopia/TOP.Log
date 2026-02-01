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

function normalizeEffect(raw: unknown) {
  if (typeof raw !== "string") return null
  const v = raw.trim().toLowerCase()
  if (v === "allow" || v === "deny") return v as "allow" | "deny"
  return null
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

export async function GET(request: Request) {
  try {
    const auth = await verifyPermissionFromRequest(request, "admin.system")
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { data, error } = await adminSupabase
      .from("department_role_permissions")
      .select("id, department_id, department_role, resource, action, effect, created_at, updated_at")
      .is("department_id", null)
      .order("resource", { ascending: true })
      .order("action", { ascending: true })
      .order("department_role", { ascending: true })
      .limit(10000)

    if (error) {
      return NextResponse.json(
        { error: "Failed to load default role permissions", message: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: data || [] })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to load default role permissions",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const auth = await verifyPermissionFromRequest(request, "admin.system")
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await request.json().catch(() => ({}))

    const department_role = normalizeName(body.department_role)
    const resource = normalizeName(body.resource)
    const action = normalizeName(body.action)
    const effect = normalizeEffect(body.effect) || "allow"

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

    const { data: existing, error: existingError } = await adminSupabase
      .from("department_role_permissions")
      .select("id")
      .is("department_id", null)
      .eq("department_role", department_role)
      .eq("resource", resource)
      .eq("action", action)
      .limit(1)
      .maybeSingle()

    if (existingError) {
      return NextResponse.json(
        { error: "Failed to check existing default", message: existingError.message },
        { status: 500 }
      )
    }

    if (existing?.id) {
      const { data, error } = await adminSupabase
        .from("department_role_permissions")
        .update({ effect, updated_by: auth.userId, updated_at: new Date().toISOString() })
        .eq("id", existing.id)
        .is("department_id", null)
        .select("id, department_id, department_role, resource, action, effect, created_at, updated_at")
        .single()

      if (error) {
        return NextResponse.json(
          { error: "Failed to update default role permission", message: error.message },
          { status: 500 }
        )
      }

      return NextResponse.json({ data })
    }

    const { data, error } = await adminSupabase
      .from("department_role_permissions")
      .insert({
        department_id: null,
        department_role,
        resource,
        action,
        effect,
        created_by: auth.userId,
        updated_by: auth.userId,
        updated_at: new Date().toISOString(),
      })
      .select("id, department_id, department_role, resource, action, effect, created_at, updated_at")
      .single()

    if (error) {
      const status = error.code === "23505" ? 409 : 500
      return NextResponse.json(
        { error: "Failed to create default role permission", message: error.message },
        { status }
      )
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to create default role permission",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await verifyPermissionFromRequest(request, "admin.system")
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const url = new URL(request.url)
    const id = (url.searchParams.get("id") || "").trim()

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 })
    }

    const { error } = await adminSupabase
      .from("department_role_permissions")
      .delete()
      .eq("id", id)
      .is("department_id", null)

    if (error) {
      return NextResponse.json(
        { error: "Failed to delete default role permission", message: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: { deleted: true } })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to delete default role permission",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
