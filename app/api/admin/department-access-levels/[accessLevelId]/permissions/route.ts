import { NextResponse } from "next/server"
import { adminSupabase } from "@/lib/supabase/admin"
import { verifyPermissionFromRequest } from "@/lib/rbac/server"

export const dynamic = "force-dynamic"

type PermissionDefinitionJoin = {
  resource?: string
  action?: string
  description?: string | null
  scope?: string
}

type AccessLevelPermissionRow = {
  id: string
  access_level_id: string
  permission_definition_id: string
  effect: string
  created_at: string
  updated_at: string
  permission_definitions: PermissionDefinitionJoin | PermissionDefinitionJoin[] | null
}

export async function GET(request: Request, { params }: { params: Promise<{ accessLevelId: string }> }) {
  try {
    const { accessLevelId } = await params
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
        permission_definitions (
          id,
          resource,
          action,
          description,
          scope
        )
      `
      )
      .eq("access_level_id", accessLevelId)
      .order("created_at", { ascending: true })

    if (error) {
      return NextResponse.json(
        { error: "Failed to load access level permissions", message: error.message },
        { status: 500 }
      )
    }

    // Transform data to include resource/action at top level for backwards compatibility
    const rows = (data || []) as AccessLevelPermissionRow[]
    const transformed = rows.map((item) => {
      const pd = Array.isArray(item.permission_definitions)
        ? item.permission_definitions[0]
        : item.permission_definitions
      return {
        ...item,
        resource: pd?.resource,
        action: pd?.action,
        description: pd?.description,
        scope: pd?.scope,
      }
    })

    return NextResponse.json({ data: transformed })
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

export async function POST(request: Request, { params }: { params: Promise<{ accessLevelId: string }> }) {
  try {
    const { accessLevelId } = await params
    const auth = await verifyPermissionFromRequest(request, "admin.system")
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await request.json().catch(() => ({}))
    const { permission_definition_id, effect = "allow" } = body

    if (!permission_definition_id) {
      return NextResponse.json({ error: "permission_definition_id is required" }, { status: 400 })
    }

    // Verify the permission definition exists and is valid for department scope
    const { data: permDef, error: permDefError } = await adminSupabase
      .from("permission_definitions")
      .select("id, resource, action, scope")
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

    const { data, error } = await adminSupabase
      .from("department_access_level_permissions")
      .insert({
        access_level_id: accessLevelId,
        permission_definition_id,
        effect,
      })
      .select(
        `
        id,
        access_level_id,
        permission_definition_id,
        effect,
        created_at,
        updated_at,
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

    // Transform for backwards compatibility
    const pd = data?.permission_definitions as
      | { resource?: string; action?: string; description?: string | null; scope?: string }
      | undefined
    const transformed = {
      ...data,
      resource: pd?.resource,
      action: pd?.action,
      description: pd?.description,
      scope: pd?.scope,
    }

    return NextResponse.json({ data: transformed }, { status: 201 })
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

export async function DELETE(request: Request, { params }: { params: Promise<{ accessLevelId: string }> }) {
  try {
    const { accessLevelId } = await params
    const auth = await verifyPermissionFromRequest(request, "admin.system")
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const url = new URL(request.url)
    const permissionId = url.searchParams.get("permissionId")

    if (!permissionId) {
      return NextResponse.json({ error: "permissionId is required" }, { status: 400 })
    }

    const { error } = await adminSupabase
      .from("department_access_level_permissions")
      .delete()
      .eq("id", permissionId)
      .eq("access_level_id", accessLevelId)

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
