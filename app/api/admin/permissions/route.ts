import { NextResponse } from "next/server"
import { adminSupabase } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

const SUPER_ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000000"
const ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000001"
const SYSTEM_ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000010"

async function verifyAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { isAdmin: false, isSuperAdmin: false, error: "Not authenticated" }
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("role_id")
    .eq("user_id", user.id)
    .single()

  if (profileError || !profile) {
    return { isAdmin: false, isSuperAdmin: false, error: "Admin access required" }
  }

  const isSuperAdmin = profile.role_id === SUPER_ADMIN_ROLE_ID
  const isAdmin = profile.role_id === ADMIN_ROLE_ID || profile.role_id === SYSTEM_ADMIN_ROLE_ID || isSuperAdmin

  if (!isAdmin) {
    return { isAdmin: false, isSuperAdmin: false, error: "Admin access required" }
  }

  return { isAdmin: true, isSuperAdmin, userId: user.id, roleId: profile.role_id }
}

function parsePermissionName(name: string) {
  const trimmed = name.trim()
  const idx = trimmed.indexOf(".")
  if (idx <= 0 || idx === trimmed.length - 1) {
    return null
  }

  return {
    resource: trimmed.slice(0, idx),
    action: trimmed.slice(idx + 1),
  }
}

export async function GET(request: Request) {
  try {
    const { isAdmin, error: authError } = await verifyAdmin()
    if (!isAdmin) {
      return NextResponse.json({ error: authError || "Admin access required" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const roleId = searchParams.get("role_id")

    if (!roleId) {
      return NextResponse.json({ error: "role_id is required" }, { status: 400 })
    }

    const { data: perms, error } = await adminSupabase
      .from("permissions")
      .select("*")
      .eq("role_id", roleId)
      .order("resource", { ascending: true })
      .order("action", { ascending: true })

    if (error) {
      console.error("Error fetching permissions:", error)
      return NextResponse.json({ error: "Failed to fetch permissions", message: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: perms || [] })
  } catch (error) {
    console.error("Admin permissions API error:", error)
    return NextResponse.json(
      {
        error: "Failed to fetch permissions",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

export async function PUT(request: Request) {
  try {
    const { isAdmin, error: authError } = await verifyAdmin()
    if (!isAdmin) {
      return NextResponse.json({ error: authError || "Admin access required" }, { status: 403 })
    }

    const body = await request.json()
    const roleId: string | undefined = body?.role_id
    const permissionNames: unknown = body?.permissions

    if (!roleId) {
      return NextResponse.json({ error: "role_id is required" }, { status: 400 })
    }

    if (!Array.isArray(permissionNames)) {
      return NextResponse.json({ error: "permissions must be an array" }, { status: 400 })
    }

    const unique = Array.from(
      new Set(
        permissionNames
          .filter((p): p is string => typeof p === "string")
          .map((p) => p.trim())
          .filter(Boolean),
      ),
    )

    const parsed = unique
      .map((name) => ({ name, parsed: parsePermissionName(name) }))
      .filter((p) => p.parsed !== null) as Array<{ name: string; parsed: { resource: string; action: string } }>

    const invalid = unique.filter((name) => !parsePermissionName(name))
    if (invalid.length > 0) {
      return NextResponse.json(
        { error: "Invalid permission name(s)", invalid },
        {
          status: 400,
        },
      )
    }

    const { data: role, error: roleError } = await adminSupabase
      .from("roles")
      .select("id")
      .eq("id", roleId)
      .single()

    if (roleError || !role) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 })
    }

    const { error: deleteError } = await adminSupabase.from("permissions").delete().eq("role_id", roleId)

    if (deleteError) {
      console.error("Error clearing permissions:", deleteError)
      return NextResponse.json(
        { error: "Failed to update permissions", message: deleteError.message },
        { status: 500 },
      )
    }

    const nowIso = new Date().toISOString()
    if (parsed.length > 0) {
      const { error: insertError } = await adminSupabase.from("permissions").insert(
        parsed.map(({ parsed }) => ({
          role_id: roleId,
          resource: parsed.resource,
          action: parsed.action,
          conditions: null,
          created_at: nowIso,
          updated_at: nowIso,
        })),
      )

      if (insertError) {
        console.error("Error inserting permissions:", insertError)
        return NextResponse.json(
          { error: "Failed to update permissions", message: insertError.message },
          { status: 500 },
        )
      }
    }

    const { data: updated, error: fetchError } = await adminSupabase
      .from("permissions")
      .select("*")
      .eq("role_id", roleId)
      .order("resource", { ascending: true })
      .order("action", { ascending: true })

    if (fetchError) {
      console.error("Error fetching updated permissions:", fetchError)
      return NextResponse.json({ data: [] })
    }

    return NextResponse.json({ data: updated || [] })
  } catch (error) {
    console.error("Admin update permissions API error:", error)
    return NextResponse.json(
      {
        error: "Failed to update permissions",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
