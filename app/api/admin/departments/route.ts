import { NextResponse } from "next/server"
import { adminSupabase } from "@/lib/supabase/admin"
import { verifyPermissionFromRequest } from "@/lib/rbac/server"

// Enable dynamic route behavior
export const dynamic = "force-dynamic"

// GET - List all departments
export async function GET(request: Request) {
  try {
    const auth = await verifyPermissionFromRequest(request, "admin.system")
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { data: departments, error } = await adminSupabase
      .from("departments")
      .select("*")
      .order("name", { ascending: true })

    if (error) {
      console.error("Error fetching departments:", error)
      return NextResponse.json({ error: "Failed to fetch departments", message: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: departments || [] })
  } catch (error) {
    console.error("Admin departments API error:", error)
    return NextResponse.json(
      {
        error: "Failed to fetch departments",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

// POST - Create a new department
export async function POST(request: Request) {
  try {
    const auth = await verifyPermissionFromRequest(request, "admin.system")
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await request.json()
    const { name, description, is_active } = body

    // Validate required fields
    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Department name is required" }, { status: 400 })
    }

    // Check if department with same name already exists (case-insensitive)
    const { data: allDepartments } = await adminSupabase.from("departments").select("id, name")

    const existing = allDepartments?.find((d) => d.name.toLowerCase() === name.trim().toLowerCase())

    if (existing) {
      return NextResponse.json({ error: "A department with this name already exists" }, { status: 409 })
    }

    // Create department using admin client (bypasses RLS)
    const { data: department, error } = await adminSupabase
      .from("departments")
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        is_active: is_active !== false,
        created_by: auth.userId,
        updated_by: auth.userId,
      })
      .select("*")
      .single()

    if (error) {
      console.error("Error creating department:", error)
      return NextResponse.json({ error: "Failed to create department", message: error.message }, { status: 500 })
    }

    // Seed default department access control based on department_roles catalog.
    if (department?.id) {
      const { data: defaultRoles, error: defaultRolesError } = await adminSupabase
        .from("department_roles")
        .select("key")
        .eq("is_active", true)
        .eq("default_can_answer_department_questions", true)
        .limit(10000)

      if (defaultRolesError) {
        console.warn("Failed to load default department roles:", defaultRolesError)
      } else {
        const keys = (defaultRoles || []).map((r) => r.key)
        if (keys.length > 0) {
          const { error: accessControlError } = await adminSupabase.from("department_role_permissions").insert(
            keys.map((department_role) => ({
              department_id: department.id,
              department_role,
              resource: "department_questions",
              action: "answer",
              created_by: auth.userId,
              updated_by: auth.userId,
              updated_at: new Date().toISOString(),
            }))
          )

          if (accessControlError) {
            console.warn("Failed to seed department access control:", accessControlError)
          }
        }
      }
    }

    return NextResponse.json({ data: department }, { status: 201 })
  } catch (error) {
    console.error("Admin create department API error:", error)
    return NextResponse.json(
      {
        error: "Failed to create department",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

// PUT - Update a department
export async function PUT(request: Request) {
  try {
    const auth = await verifyPermissionFromRequest(request, "admin.system")
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await request.json()
    const { id, name, description, is_active } = body

    if (!id) {
      return NextResponse.json({ error: "Department ID is required" }, { status: 400 })
    }

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Department name is required" }, { status: 400 })
    }

    // Check if another department with same name exists (case-insensitive)
    const { data: allDepartments } = await adminSupabase.from("departments").select("id, name")

    const existing = allDepartments?.find((d) => d.id !== id && d.name.toLowerCase() === name.trim().toLowerCase())

    if (existing) {
      return NextResponse.json({ error: "A department with this name already exists" }, { status: 409 })
    }

    // Update department using admin client
    const { data: department, error } = await adminSupabase
      .from("departments")
      .update({
        name: name.trim(),
        description: description?.trim() || null,
        is_active: is_active !== false,
        updated_by: auth.userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single()

    if (error) {
      console.error("Error updating department:", error)
      return NextResponse.json({ error: "Failed to update department", message: error.message }, { status: 500 })
    }

    if (!department) {
      return NextResponse.json({ error: "Department not found" }, { status: 404 })
    }

    return NextResponse.json({ data: department })
  } catch (error) {
    console.error("Admin update department API error:", error)
    return NextResponse.json(
      {
        error: "Failed to update department",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

// DELETE - Delete a department
export async function DELETE(request: Request) {
  try {
    const auth = await verifyPermissionFromRequest(request, "admin.system")
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Department ID is required" }, { status: 400 })
    }

    // Check if department has any roles assigned
    const { data: roles, error: rolesError } = await adminSupabase
      .from("roles")
      .select("id")
      .eq("department_id", id)
      .limit(1)

    if (rolesError) {
      console.error("Error checking roles:", rolesError)
      // Continue with deletion attempt
    }

    if (roles && roles.length > 0) {
      return NextResponse.json(
        { error: "Cannot delete department. It has roles assigned. Please remove all roles first." },
        { status: 409 }
      )
    }

    // Delete department using admin client
    const { error } = await adminSupabase.from("departments").delete().eq("id", id)

    if (error) {
      console.error("Error deleting department:", error)
      return NextResponse.json({ error: "Failed to delete department", message: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Admin delete department API error:", error)
    return NextResponse.json(
      {
        error: "Failed to delete department",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
