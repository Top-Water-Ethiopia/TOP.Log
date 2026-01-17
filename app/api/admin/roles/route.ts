import { NextResponse } from "next/server"
import { adminSupabase } from "@/lib/supabase/admin"
import { verifyPermission } from "@/lib/rbac/server"

// Enable dynamic route behavior
export const dynamic = "force-dynamic"

const ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000001"
const SYSTEM_ADMIN_ROLE_ID = "00000000-0000-0000-0000-000000000010"

// GET - List all roles with departments
export async function GET() {
  try {
    const auth = await verifyPermission("admin.system")
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { data: roles, error } = await adminSupabase
      .from("roles")
      .select(
        `
        *,
        department:departments(*)
      `
      )
      .order("name", { ascending: true })

    if (error) {
      console.error("Error fetching roles:", error)
      return NextResponse.json({ error: "Failed to fetch roles", message: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: roles || [] })
  } catch (error) {
    console.error("Admin roles API error:", error)
    return NextResponse.json(
      {
        error: "Failed to fetch roles",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

// POST - Create a new role
export async function POST(request: Request) {
  try {
    const auth = await verifyPermission("admin.system")
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await request.json()
    const { name, description, department_id } = body

    // Validate required fields
    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Role name is required" }, { status: 400 })
    }

    // Prevent creating system roles
    if (["admin", "system-admin", "user"].includes(name.trim().toLowerCase())) {
      return NextResponse.json({ error: "Cannot create system roles" }, { status: 403 })
    }

    // Validate name format (lowercase alphanumeric with hyphens)
    const nameRegex = /^[a-z0-9-]+$/
    if (!nameRegex.test(name.trim())) {
      return NextResponse.json({ error: "Role name must be lowercase alphanumeric with hyphens only" }, { status: 400 })
    }

    // Check if role with same name already exists (case-insensitive)
    const { data: allRoles } = await adminSupabase.from("roles").select("id, name")

    const existing = allRoles?.find((r) => r.name.toLowerCase() === name.trim().toLowerCase())

    if (existing) {
      return NextResponse.json({ error: "A role with this name already exists" }, { status: 409 })
    }

    // Validate department if provided
    if (department_id) {
      const { data: dept } = await adminSupabase.from("departments").select("id").eq("id", department_id).single()

      if (!dept) {
        return NextResponse.json({ error: "Invalid department selected" }, { status: 400 })
      }
    }

    // Create role using admin client
    const { data: role, error } = await adminSupabase
      .from("roles")
      .insert({
        name: name.trim().toLowerCase(),
        description: description?.trim() || null,
        department_id: department_id || null,
      })
      .select(
        `
        *,
        department:departments(*)
      `
      )
      .single()

    if (error) {
      console.error("Error creating role:", error)
      return NextResponse.json({ error: "Failed to create role", message: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: role }, { status: 201 })
  } catch (error) {
    console.error("Admin create role API error:", error)
    return NextResponse.json(
      {
        error: "Failed to create role",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

// PUT - Update a role
export async function PUT(request: Request) {
  try {
    const auth = await verifyPermission("admin.system")
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await request.json()
    const { id, name, description, department_id } = body

    if (!id) {
      return NextResponse.json({ error: "Role ID is required" }, { status: 400 })
    }

    // Prevent updating system roles
    if (
      id === ADMIN_ROLE_ID ||
      id === SYSTEM_ADMIN_ROLE_ID ||
      name === "admin" ||
      name === "system-admin" ||
      name === "user"
    ) {
      return NextResponse.json({ error: "Cannot modify system roles" }, { status: 403 })
    }

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Role name is required" }, { status: 400 })
    }

    // Validate name format
    const nameRegex = /^[a-z0-9-]+$/
    if (!nameRegex.test(name.trim())) {
      return NextResponse.json({ error: "Role name must be lowercase alphanumeric with hyphens only" }, { status: 400 })
    }

    // Check if another role with same name exists (case-insensitive)
    const { data: allRoles } = await adminSupabase.from("roles").select("id, name")

    const existing = allRoles?.find((r) => r.id !== id && r.name.toLowerCase() === name.trim().toLowerCase())

    if (existing) {
      return NextResponse.json({ error: "A role with this name already exists" }, { status: 409 })
    }

    // Validate department if provided
    if (department_id) {
      const { data: dept } = await adminSupabase.from("departments").select("id").eq("id", department_id).single()

      if (!dept) {
        return NextResponse.json({ error: "Invalid department selected" }, { status: 400 })
      }
    }

    // Update role using admin client
    const { data: role, error } = await adminSupabase
      .from("roles")
      .update({
        name: name.trim().toLowerCase(),
        description: description?.trim() || null,
        department_id: department_id || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select(
        `
        *,
        department:departments(*)
      `
      )
      .single()

    if (error) {
      console.error("Error updating role:", error)
      return NextResponse.json({ error: "Failed to update role", message: error.message }, { status: 500 })
    }

    if (!role) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 })
    }

    return NextResponse.json({ data: role })
  } catch (error) {
    console.error("Admin update role API error:", error)
    return NextResponse.json(
      {
        error: "Failed to update role",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

// DELETE - Delete a role
export async function DELETE(request: Request) {
  try {
    const auth = await verifyPermission("admin.system")
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Role ID is required" }, { status: 400 })
    }

    // Prevent deleting system roles
    if (id === ADMIN_ROLE_ID || id === SYSTEM_ADMIN_ROLE_ID) {
      return NextResponse.json({ error: "Cannot delete system roles" }, { status: 403 })
    }

    // Check if role has users assigned
    const { data: users, error: usersError } = await adminSupabase
      .from("user_profiles")
      .select("id")
      .eq("role_id", id)
      .limit(1)

    if (usersError) {
      console.error("Error checking users:", usersError)
      // Continue with deletion attempt
    }

    if (users && users.length > 0) {
      return NextResponse.json(
        { error: "Cannot delete role. It has users assigned. Please reassign users first." },
        { status: 409 }
      )
    }

    // Delete role using admin client
    const { error } = await adminSupabase.from("roles").delete().eq("id", id)

    if (error) {
      console.error("Error deleting role:", error)
      return NextResponse.json({ error: "Failed to delete role", message: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Admin delete role API error:", error)
    return NextResponse.json(
      {
        error: "Failed to delete role",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
