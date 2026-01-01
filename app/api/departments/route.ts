import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data, error } = await supabase
      .from("user_department_roles")
      .select(
        `
        department_id,
        role,
        is_active,
        departments (
          id,
          name,
          description,
          is_active
        )
      `,
      )
      .eq("user_id", user.id)
      .eq("is_active", true)

    if (error) {
      return NextResponse.json(
        { error: "Failed to load departments", message: error.message },
        { status: 500 },
      )
    }

    const normalized = (data || [])
      .map((row: any) => {
        const dept = row.departments
        if (!dept?.id) return null
        return {
          department_id: row.department_id,
          role: row.role,
          department: {
            id: dept.id,
            name: dept.name,
            description: dept.description ?? null,
            is_active: dept.is_active,
          },
        }
      })
      .filter(Boolean)

    return NextResponse.json({ data: normalized })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
