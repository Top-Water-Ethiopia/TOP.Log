import { NextResponse } from "next/server"
import { adminSupabase } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

const ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000001"
const SYSTEM_ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000010"

async function verifyAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { isAdmin: false as const, error: "Not authenticated" }
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("role_id")
    .eq("user_id", user.id)
    .single()

  if (profileError || !profile) {
    return { isAdmin: false as const, error: "Admin access required" }
  }

  const isAdmin = profile.role_id === ADMIN_ROLE_ID || profile.role_id === SYSTEM_ADMIN_ROLE_ID

  if (!isAdmin) {
    return { isAdmin: false as const, error: "Admin access required" }
  }

  return { isAdmin: true as const, userId: user.id }
}

const nameRegex = /^[a-z0-9-]+$/

export async function GET(_request: Request, { params }: { params: Promise<{ departmentId: string }> }) {
  try {
    const { isAdmin, error: authError } = await verifyAdmin()
    if (!isAdmin) {
      return NextResponse.json({ error: authError || "Admin access required" }, { status: 403 })
    }

    const { departmentId } = await params

    const { data: roles, error } = await adminSupabase
      .from("roles")
      .select("*")
      .eq("department_id", departmentId)
      .order("name", { ascending: true })

    if (error) {
      return NextResponse.json({ error: "Failed to fetch roles", message: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: roles || [] })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch roles", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ departmentId: string }> }) {
  try {
    const { isAdmin, error: authError } = await verifyAdmin()
    if (!isAdmin) {
      return NextResponse.json({ error: authError || "Admin access required" }, { status: 403 })
    }

    const { departmentId } = await params
    const body = await request.json().catch(() => ({}))

    const name = (body.name as string | undefined)?.trim() || ""
    const description = (body.description as string | undefined)?.trim() || null
    const level = typeof body.level === "number" ? (body.level as number) : undefined

    if (!name) {
      return NextResponse.json({ error: "Role name is required" }, { status: 400 })
    }

    if (!nameRegex.test(name)) {
      return NextResponse.json({ error: "Role name must be lowercase alphanumeric with hyphens only" }, { status: 400 })
    }

    const normalizedName = name.toLowerCase()

    const { data: existing, error: existingError } = await adminSupabase
      .from("roles")
      .select("id")
      .eq("name", normalizedName)
      .limit(1)

    if (existingError) {
      return NextResponse.json(
        { error: "Failed to validate role name", message: existingError.message },
        { status: 500 }
      )
    }

    if (existing && existing.length > 0) {
      return NextResponse.json({ error: "A role with this name already exists" }, { status: 409 })
    }

    const insertPayload: {
      name: string
      description: string | null
      department_id: string
      level?: number
    } = {
      name: normalizedName,
      description,
      department_id: departmentId,
    }
    if (level !== undefined) insertPayload.level = level

    const { data: role, error } = await adminSupabase.from("roles").insert(insertPayload).select("*").single()

    if (error) {
      return NextResponse.json({ error: "Failed to create role", message: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: role }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create role", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ departmentId: string }> }) {
  try {
    const { isAdmin, error: authError } = await verifyAdmin()
    if (!isAdmin) {
      return NextResponse.json({ error: authError || "Admin access required" }, { status: 403 })
    }

    const { departmentId } = await params
    const body = await request.json().catch(() => ({}))

    const id = body.id as string | undefined
    const name = (body.name as string | undefined)?.trim() || ""
    const description = (body.description as string | undefined)?.trim() || null
    const level = typeof body.level === "number" ? (body.level as number) : undefined

    if (!id) {
      return NextResponse.json({ error: "Role ID is required" }, { status: 400 })
    }

    if (!name) {
      return NextResponse.json({ error: "Role name is required" }, { status: 400 })
    }

    if (!nameRegex.test(name)) {
      return NextResponse.json({ error: "Role name must be lowercase alphanumeric with hyphens only" }, { status: 400 })
    }

    const normalizedName = name.toLowerCase()

    const { data: existingRole, error: existingRoleError } = await adminSupabase
      .from("roles")
      .select("id, department_id")
      .eq("id", id)
      .maybeSingle()

    if (existingRoleError) {
      return NextResponse.json({ error: "Failed to load role", message: existingRoleError.message }, { status: 500 })
    }

    if (!existingRole || existingRole.department_id !== departmentId) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 })
    }

    const { data: existing, error: existingError } = await adminSupabase
      .from("roles")
      .select("id")
      .eq("name", normalizedName)
      .neq("id", id)
      .limit(1)

    if (existingError) {
      return NextResponse.json(
        { error: "Failed to validate role name", message: existingError.message },
        { status: 500 }
      )
    }

    if (existing && existing.length > 0) {
      return NextResponse.json({ error: "A role with this name already exists" }, { status: 409 })
    }

    const updatePayload: {
      name: string
      description: string | null
      updated_at: string
      level?: number
    } = {
      name: normalizedName,
      description,
      updated_at: new Date().toISOString(),
    }
    if (level !== undefined) updatePayload.level = level

    const { data: role, error } = await adminSupabase
      .from("roles")
      .update(updatePayload)
      .eq("id", id)
      .select("*")
      .single()

    if (error) {
      return NextResponse.json({ error: "Failed to update role", message: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: role })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update role", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ departmentId: string }> }) {
  try {
    const { isAdmin, error: authError } = await verifyAdmin()
    if (!isAdmin) {
      return NextResponse.json({ error: authError || "Admin access required" }, { status: 403 })
    }

    const { departmentId } = await params
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Role ID is required" }, { status: 400 })
    }

    const { data: role, error: roleError } = await adminSupabase
      .from("roles")
      .select("id, department_id")
      .eq("id", id)
      .maybeSingle()

    if (roleError) {
      return NextResponse.json({ error: "Failed to load role", message: roleError.message }, { status: 500 })
    }

    if (!role || role.department_id !== departmentId) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 })
    }

    const { data: assignments } = await adminSupabase
      .from("user_department_professions")
      .select("id")
      .eq("department_id", departmentId)
      .eq("role_id", id)
      .limit(1)

    if (assignments && assignments.length > 0) {
      return NextResponse.json(
        { error: "Cannot delete role. It has users assigned. Please reassign users first." },
        { status: 409 }
      )
    }

    const { data: questions } = await adminSupabase.from("role_questions").select("id").eq("role_id", id).limit(1)

    if (questions && questions.length > 0) {
      return NextResponse.json(
        { error: "Cannot delete role. It has role questions. Please remove questions first." },
        { status: 409 }
      )
    }

    const { error } = await adminSupabase.from("roles").delete().eq("id", id)

    if (error) {
      return NextResponse.json({ error: "Failed to delete role", message: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete role", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
