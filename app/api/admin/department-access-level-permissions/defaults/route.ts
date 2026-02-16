import { NextResponse } from "next/server"
import { adminSupabase } from "@/lib/supabase/admin"
import { verifyPermissionFromRequest } from "@/lib/rbac/server"

export const dynamic = "force-dynamic"

function normalizeEffect(raw: unknown) {
  if (typeof raw !== "string") return null
  const v = raw.trim().toLowerCase()
  if (v === "allow" || v === "deny") return v as "allow" | "deny"
  return null
}

async function validateAccessLevel(accessLevelId: string) {
  const { data, error } = await adminSupabase
    .from("department_access_levels")
    .select("name, is_active")
    .eq("id", accessLevelId)
    .maybeSingle()

  if (error) {
    return { ok: false as const, error: "Failed to validate access level", message: error.message }
  }

  if (!data) {
    return { ok: false as const, error: "Invalid access level" }
  }

  return { ok: true as const, isActive: !!data.is_active, name: data.name }
}

export async function GET(request: Request) {
  try {
    const auth = await verifyPermissionFromRequest(request, "admin.system")
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { data, error } = await adminSupabase
      .from("department_access_level_permissions")
      .select(
        `
        id,
        access_level_id,
        permission_definition_id,
        effect,
        created_at,
        updated_at,
        department_access_levels (
          name,
          display_name,
          level
        ),
        permission_definitions (
          id,
          resource,
          action,
          description,
          scope
        )
      `
      )
      .order("created_at", { ascending: true })
      .limit(10000)

    if (error) {
      return NextResponse.json(
        { error: "Failed to load access level permissions", message: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: data || [] })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to load access level permissions",
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

    const access_level_id = typeof body.access_level_id === "string" ? body.access_level_id.trim() : null
    const permission_definition_id =
      typeof body.permission_definition_id === "string" ? body.permission_definition_id.trim() : null
    const effect = normalizeEffect(body.effect) || "allow"

    if (!access_level_id) {
      return NextResponse.json({ error: "access_level_id is required" }, { status: 400 })
    }
    if (!permission_definition_id) {
      return NextResponse.json({ error: "permission_definition_id is required" }, { status: 400 })
    }

    const accessLevelCheck = await validateAccessLevel(access_level_id)
    if (!accessLevelCheck.ok) {
      return NextResponse.json({ error: accessLevelCheck.error, message: accessLevelCheck.message }, { status: 400 })
    }

    if (!accessLevelCheck.isActive) {
      return NextResponse.json({ error: "Access level is not active" }, { status: 400 })
    }

    // Verify the permission definition exists and is valid for department scope
    const { data: permDef, error: permDefError } = await adminSupabase
      .from("permission_definitions")
      .select("id, scope")
      .eq("id", permission_definition_id)
      .single()

    if (permDefError || !permDef) {
      return NextResponse.json({ error: "Invalid permission definition" }, { status: 400 })
    }

    if (permDef.scope === "system") {
      return NextResponse.json(
        { error: "Cannot assign system-only permission to department access level" },
        { status: 400 }
      )
    }

    const { data: existing, error: existingError } = await adminSupabase
      .from("department_access_level_permissions")
      .select("id")
      .eq("access_level_id", access_level_id)
      .eq("permission_definition_id", permission_definition_id)
      .limit(1)
      .maybeSingle()

    if (existingError) {
      return NextResponse.json(
        { error: "Failed to check existing permission", message: existingError.message },
        { status: 500 }
      )
    }

    if (existing?.id) {
      const { data, error } = await adminSupabase
        .from("department_access_level_permissions")
        .update({ effect, updated_at: new Date().toISOString() })
        .eq("id", existing.id)
        .select(
          `
          id,
          access_level_id,
          permission_definition_id,
          effect,
          created_at,
          updated_at,
          department_access_levels (
            name,
            display_name,
            level
          ),
          permission_definitions (
            id,
            resource,
            action,
            description,
            scope
          )
        `
        )
        .single()

      if (error) {
        return NextResponse.json(
          { error: "Failed to update access level permission", message: error.message },
          { status: 500 }
        )
      }

      return NextResponse.json({ data })
    }

    const { data, error } = await adminSupabase
      .from("department_access_level_permissions")
      .insert({
        access_level_id,
        permission_definition_id,
        effect,
        updated_at: new Date().toISOString(),
      })
      .select(
        `
        id,
        access_level_id,
        permission_definition_id,
        effect,
        created_at,
        updated_at,
        department_access_levels (
          name,
          display_name,
          level
        ),
        permission_definitions (
          id,
          resource,
          action,
          description,
          scope
        )
      `
      )
      .single()

    if (error) {
      const status = error.code === "23505" ? 409 : 500
      return NextResponse.json(
        { error: "Failed to create access level permission", message: error.message },
        { status }
      )
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to create access level permission",
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

    const { error } = await adminSupabase.from("department_access_level_permissions").delete().eq("id", id)

    if (error) {
      return NextResponse.json(
        { error: "Failed to delete access level permission", message: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: { deleted: true } })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to delete access level permission",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
